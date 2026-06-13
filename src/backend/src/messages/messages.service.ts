import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';
import { CreateMessageDto } from './dto/message.dto';

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private messagesGateway: MessagesGateway,
  ) {}

  async create(conversationId: string, senderId: string, data: CreateMessageDto) {
    const nextContent = data.content?.trim() || '';
    const attachmentIds = [...new Set(data.attachmentIds || [])];
    if (!nextContent && attachmentIds.length === 0) throw new BadRequestException('Message cannot be empty');

    // 验证用户是该会话参与者
    await this.ensureParticipant(conversationId, senderId);
    await this.ensureCanSend(conversationId, senderId);

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

    if (attachmentIds.length > 0) {
      const ownedAttachments = await this.prisma.attachment.findMany({
        where: {
          id: { in: attachmentIds },
          uploaderId: senderId,
          messageId: null,
        },
        select: { id: true },
      });

      if (ownedAttachments.length !== attachmentIds.length) {
        throw new BadRequestException('Invalid attachment');
      }
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

      if (attachmentIds.length > 0) {
        await prisma.attachment.updateMany({
          where: {
            id: { in: attachmentIds },
            uploaderId: senderId,
            messageId: null,
          },
          data: { messageId: created.id },
        });
      }

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await prisma.userConversation.update({
        where: { userId_conversationId: { userId: senderId, conversationId } },
        data: { lastReadAt: new Date(), archivedAt: null },
      });

      const messageWithAttachments = await prisma.message.findUnique({
        where: { id: created.id },
        include: this.messageInclude(),
      });

      if (!messageWithAttachments) {
        throw new InternalServerErrorException('Message was not created');
      }

      return messageWithAttachments;
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

  async listAttachments(
    conversationId: string,
    userId: string,
    options: { kind?: string; limit?: number; beforeCreatedAt?: string; beforeId?: string } = {},
  ) {
    await this.ensureParticipant(conversationId, userId);

    const limit = Math.min(Math.max(options.limit || 40, 1), 100);
    const where: any = {
      messageId: { not: null },
      message: {
        conversationId,
        deletedAt: null,
      },
    };

    if (options.kind) {
      where.kind = options.kind;
    }

    if (options.beforeCreatedAt && options.beforeId) {
      const beforeDate = new Date(options.beforeCreatedAt);
      where.OR = [
        { createdAt: { lt: beforeDate } },
        { createdAt: beforeDate, id: { lt: options.beforeId } },
      ];
    }

    const attachments = await this.prisma.attachment.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      include: {
        uploader: { select: { id: true, username: true, avatar: true } },
        message: {
          select: {
            id: true,
            content: true,
            type: true,
            conversationId: true,
            createdAt: true,
            sender: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    return {
      attachments,
      hasMore: attachments.length === limit,
    };
  }

  async listLinks(
    conversationId: string,
    userId: string,
    options: { limit?: number; beforeCreatedAt?: string; beforeId?: string } = {},
  ) {
    await this.ensureParticipant(conversationId, userId);

    const limit = Math.min(Math.max(options.limit || 40, 1), 100);
    const where: any = {
      conversationId,
      deletedAt: null,
      content: { contains: 'http', mode: 'insensitive' },
    };

    if (options.beforeCreatedAt && options.beforeId) {
      const beforeDate = new Date(options.beforeCreatedAt);
      where.OR = [
        { createdAt: { lt: beforeDate } },
        { createdAt: beforeDate, id: { lt: options.beforeId } },
      ];
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit * 3,
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    const links = messages.flatMap(message =>
      this.extractLinks(message.content).map(url => ({
        id: `${message.id}:${url}`,
        url,
        title: this.linkTitle(url),
        messageId: message.id,
        conversationId: message.conversationId,
        content: message.content,
        createdAt: message.createdAt,
        sender: message.sender,
      })),
    ).slice(0, limit);

    return {
      links,
      hasMore: messages.length === limit * 3,
    };
  }

  async listPinned(conversationId: string, userId: string) {
    await this.ensureParticipant(conversationId, userId);
    return this.getPinnedMessages(conversationId);
  }

  async pinMessage(messageId: string, userId: string) {
    const message = await this.findMessageWithAccess(messageId, userId);
    if (message.deletedAt) throw new BadRequestException('Cannot pin deleted message');
    await this.ensureCanManagePins(message.conversationId, userId);

    await this.prisma.pinnedMessage.upsert({
      where: {
        conversationId_messageId: {
          conversationId: message.conversationId,
          messageId,
        },
      },
      update: {
        pinnedById: userId,
        pinnedAt: new Date(),
      },
      create: {
        conversationId: message.conversationId,
        messageId,
        pinnedById: userId,
      },
    });

    const pinnedMessages = await this.getPinnedMessages(message.conversationId);
    this.messagesGateway.emitPinnedMessages({ conversationId: message.conversationId, pinnedMessages });
    return { pinnedMessages };
  }

  async unpinMessage(conversationId: string, messageId: string, userId: string) {
    await this.ensureParticipant(conversationId, userId);
    await this.ensureCanManagePins(conversationId, userId);

    await this.prisma.pinnedMessage.delete({
      where: {
        conversationId_messageId: {
          conversationId,
          messageId,
        },
      },
    }).catch(() => undefined);

    const pinnedMessages = await this.getPinnedMessages(conversationId);
    this.messagesGateway.emitPinnedMessages({ conversationId, pinnedMessages });
    return { pinnedMessages };
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

    const deleted = await this.prisma.$transaction(async prisma => {
      const nextMessage = await prisma.message.update({
        where: { id: messageId },
        data: { content: '', deletedAt: new Date() },
        include: this.messageInclude(),
      });

      await prisma.pinnedMessage.deleteMany({
        where: { messageId },
      });

      return nextMessage;
    });

    this.messagesGateway.emitMessageDeleted(deleted);
    const pinnedMessages = await this.getPinnedMessages(deleted.conversationId);
    this.messagesGateway.emitPinnedMessages({ conversationId: deleted.conversationId, pinnedMessages });
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

  private async ensureCanSend(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { select: { userId: true } },
      },
    });

    if (!conversation || conversation.type !== 'direct') return;

    const targetUserId = conversation.participants.find(participant => participant.userId !== userId)?.userId;
    if (!targetUserId) return;

    const block = await this.prisma.blockList.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenException('Cannot send messages in this conversation');
    }
  }

  private async ensureCanManagePins(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        group: {
          include: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'group') return;

    const role = conversation.group?.members[0]?.role;
    if (!role || !['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Admin permission required');
    }
  }

  private getPinnedMessages(conversationId: string) {
    return this.prisma.pinnedMessage.findMany({
      where: {
        conversationId,
        message: { deletedAt: null },
      },
      orderBy: { pinnedAt: 'desc' },
      include: this.pinnedMessageInclude(),
    });
  }

  private pinnedMessageInclude() {
    return {
      pinnedBy: { select: { id: true, username: true, avatar: true } },
      message: {
        include: this.messageInclude(),
      },
    };
  }

  private extractLinks(content: string) {
    return Array.from(content.matchAll(URL_PATTERN))
      .map(match => match[0].replace(/[.,!?;:]+$/, ''))
      .filter((url, index, urls) => urls.indexOf(url) === index);
  }

  private linkTitle(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
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
      attachments: {
        orderBy: { createdAt: 'asc' as const },
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
