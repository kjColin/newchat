import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { CreateMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private messagesGateway: MessagesGateway,
  ) {}

  async create(conversationId: string, senderId: string, data: CreateMessageDto) {
    const nextContent = data.content.trim();
    if (!nextContent) throw new BadRequestException('Message cannot be empty');

    // 验证用户是该会话参与者
    await this.ensureParticipant(conversationId, senderId);

    if (data.clientId) {
      const existing = await this.prisma.message.findUnique({
        where: {
          senderId_clientId: {
            senderId,
            clientId: data.clientId,
          },
        },
        include: this.messageInclude(),
      });
      if (existing) return existing;
    }

    if (data.replyToId) {
      const replyTo = await this.findMessageWithAccess(data.replyToId, senderId);
      if (replyTo.conversationId !== conversationId) {
        throw new BadRequestException('Reply target must be in the same conversation');
      }
      if (replyTo.deletedAt) throw new BadRequestException('Cannot reply to deleted message');
    }

    if (data.forwardFromId) {
      const forwardFrom = await this.findMessageWithAccess(data.forwardFromId, senderId);
      if (forwardFrom.deletedAt) throw new BadRequestException('Cannot forward deleted message');
    }

    const message = await this.prisma.$transaction(async prisma => {
      const created = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          content: nextContent,
          type: data.type || 'text',
          clientId: data.clientId,
          replyToId: data.replyToId,
          forwardFromId: data.forwardFromId,
        },
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

  async forward(messageId: string, userId: string, targetConversationId: string, clientId?: string) {
    const source = await this.findMessageWithAccess(messageId, userId);
    if (source.deletedAt) throw new BadRequestException('Cannot forward deleted message');
    await this.ensureParticipant(targetConversationId, userId);

    return this.create(targetConversationId, userId, {
      conversationId: targetConversationId,
      content: source.content,
      type: source.type,
      clientId,
      forwardFromId: source.id,
    });
  }

  async search(conversationId: string, userId: string, query: string, limit = 20) {
    await this.ensureParticipant(conversationId, userId);
    const q = query.trim();
    if (q.length < 2) return { messages: [] };

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        content: { contains: q, mode: 'insensitive' },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: Math.min(Math.max(limit, 1), 50),
      include: this.messageInclude(),
    });

    return { messages };
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    limit = 50,
    cursor: { beforeCreatedAt?: string; beforeId?: string; before?: string } = {},
  ) {
    // 验证权限
    await this.ensureParticipant(conversationId, userId);

    const where: any = { conversationId };
    if (cursor.beforeCreatedAt && cursor.beforeId) {
      const beforeDate = new Date(cursor.beforeCreatedAt);
      where.OR = [
        { createdAt: { lt: beforeDate } },
        { createdAt: beforeDate, id: { lt: cursor.beforeId } },
      ];
    } else if (cursor.before) {
      const beforeMessage = await this.prisma.message.findFirst({
        where: { id: cursor.before, conversationId },
        select: { id: true, createdAt: true },
      });

      if (beforeMessage) {
        where.OR = [
          { createdAt: { lt: beforeMessage.createdAt } },
          { createdAt: beforeMessage.createdAt, id: { lt: beforeMessage.id } },
        ];
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: Math.min(Math.max(limit, 1), 100),
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

    await this.ensureParticipant(message.conversationId, userId);

    return message;
  }

  private async ensureParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!participant) throw new ForbiddenException('Not in conversation');
    return participant;
  }

  private messageInclude() {
    return {
      sender: { select: { id: true, username: true, avatar: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: { select: { id: true, username: true, avatar: true } },
        },
      },
      forwardFrom: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: { select: { id: true, username: true, avatar: true } },
        },
      },
      reactions: {
        include: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }
}
