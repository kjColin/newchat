import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private messagesGateway: MessagesGateway,
  ) {}

  async create(conversationId: string, senderId: string, content: string, type = 'text') {
    // 验证用户是该会话参与者
    const participant = await this.prisma.userConversation.findUnique({
      where: {
        userId_conversationId: { userId: senderId, conversationId },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Not in conversation');
    }

    const message = await this.prisma.$transaction(async prisma => {
      const created = await prisma.message.create({
        data: { conversationId, senderId, content, type },
        include: this.messageInclude(),
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await prisma.userConversation.update({
        where: { userId_conversationId: { userId: senderId, conversationId } },
        data: { lastReadAt: new Date(), archivedAt: null },
      });

      return created;
    });

    this.messagesGateway.emitMessage(message);
    return message;
  }

  async findByConversation(conversationId: string, userId: string, limit = 50, before?: string) {
    // 验证权限
    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!participant) {
      throw new ForbiddenException('Not in conversation');
    }

    const where: any = { conversationId };
    if (before) {
      where.id = { lt: before };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.messageInclude(),
    });

    return {
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    };
  }

  async edit(messageId: string, userId: string, content: string) {
    const nextContent = content.trim();
    if (!nextContent) throw new BadRequestException('Message cannot be empty');

    const message = await this.findMessageWithAccess(messageId, userId);
    if (message.senderId !== userId) throw new ForbiddenException('Can only edit your own messages');
    if (message.deletedAt) throw new BadRequestException('Cannot edit deleted message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: nextContent, editedAt: new Date() },
      include: this.messageInclude(),
    });

    this.messagesGateway.emitMessageUpdated(updated);
    return updated;
  }

  async remove(messageId: string, userId: string) {
    const message = await this.findMessageWithAccess(messageId, userId);
    if (message.senderId !== userId) throw new ForbiddenException('Can only delete your own messages');

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: '', deletedAt: new Date() },
      include: this.messageInclude(),
    });

    this.messagesGateway.emitMessageDeleted(deleted);
    return deleted;
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const normalizedEmoji = emoji.trim().slice(0, 16);
    if (!normalizedEmoji) throw new BadRequestException('Reaction is required');

    const message = await this.findMessageWithAccess(messageId, userId);
    if (message.deletedAt) throw new BadRequestException('Cannot react to deleted message');

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        userId_messageId_emoji: {
          userId,
          messageId,
          emoji: normalizedEmoji,
        },
      },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { userId, messageId, emoji: normalizedEmoji },
      });
    }

    const updated = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: this.messageInclude(),
    });

    this.messagesGateway.emitReaction(updated);
    return updated;
  }

  async markRead(conversationId: string, userId: string) {
    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!participant) throw new ForbiddenException('Not in conversation');

    const lastReadAt = new Date();
    await this.prisma.userConversation.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { lastReadAt },
    });

    const payload = { conversationId, userId, lastReadAt: lastReadAt.toISOString() };
    this.messagesGateway.emitRead(payload);
    return payload;
  }

  private async findMessageWithAccess(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Message not found');

    const participant = await this.prisma.userConversation.findUnique({
      where: {
        userId_conversationId: {
          userId,
          conversationId: message.conversationId,
        },
      },
    });

    if (!participant) throw new ForbiddenException('Not in conversation');

    return message;
  }

  private messageInclude() {
    return {
      sender: { select: { id: true, username: true, avatar: true } },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}
