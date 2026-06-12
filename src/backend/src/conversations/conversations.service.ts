import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async createDirect(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ForbiddenException('Cannot create a direct conversation with yourself');
    }

    const existing = await this.prisma.conversation.findMany({
      where: {
        type: 'direct',
        participants: {
          some: { userId },
        },
      },
      include: this.conversationInclude(),
    });

    const directConversation = existing.find(conversation =>
      conversation.participants.length === 2 &&
      conversation.participants.some(participant => participant.userId === targetUserId)
    );

    if (directConversation) {
      return this.formatDirectConversation(directConversation, userId);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'direct',
        participants: {
          create: [
            { userId },
            { userId: targetUserId },
          ],
        },
      },
      include: this.conversationInclude(),
    });

    return this.formatDirectConversation(conversation, userId);
  }

  async findByUser(userId: string) {
    const conversations = await this.prisma.userConversation.findMany({
      where: { userId, archivedAt: null },
      include: {
        conversation: {
          include: this.conversationInclude(),
        },
      },
    });

    const formatted = await Promise.all(conversations.map(async membership => {
      const { conversation } = membership;
      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          createdAt: { gt: membership.lastReadAt || membership.addedAt },
          deletedAt: null,
        },
      });

      const settings = {
        lastReadAt: membership.lastReadAt,
        pinnedAt: membership.pinnedAt,
        mutedUntil: membership.mutedUntil,
        archivedAt: membership.archivedAt,
        unreadCount,
        lastActivityAt: conversation.messages[0]?.createdAt || conversation.updatedAt,
      };

      if (conversation.type === 'direct') {
        return this.formatDirectConversation(conversation, userId, settings);
      }

      return this.formatGroupConversation(
        conversation.group,
        conversation,
        conversation.group?._count.members || conversation.participants.length,
        settings,
      );
    }));

    return formatted.filter(Boolean).sort((a: any, b: any) => {
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }

  async updateSettings(
    conversationId: string,
    userId: string,
    data: { pinned?: boolean; muted?: boolean; archived?: boolean },
  ) {
    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!participant) throw new ForbiddenException('Not in conversation');

    const mutedUntil = data.muted === undefined
      ? undefined
      : data.muted ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;

    await this.prisma.userConversation.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: {
        pinnedAt: data.pinned === undefined ? undefined : data.pinned ? new Date() : null,
        mutedUntil,
        archivedAt: data.archived === undefined ? undefined : data.archived ? new Date() : null,
      },
    });

    return this.findByUser(userId);
  }

  formatGroupConversation(group: any, conversation: any, memberCount: number, settings: any = {}) {
    if (!group) return null;

    return {
      id: conversation.id,
      conversationId: conversation.id,
      groupId: group.id,
      type: 'group',
      name: group.name,
      avatar: group.avatar,
      role: 'member',
      memberCount,
      lastMessage: conversation.messages?.[0] || null,
      unreadCount: settings.unreadCount || 0,
      lastReadAt: settings.lastReadAt,
      pinnedAt: settings.pinnedAt,
      mutedUntil: settings.mutedUntil,
      archivedAt: settings.archivedAt,
      lastActivityAt: settings.lastActivityAt || conversation.updatedAt,
    };
  }

  private formatDirectConversation(conversation: any, currentUserId: string, settings: any = {}) {
    const other = conversation.participants.find(participant => participant.userId !== currentUserId)?.user;

    return {
      id: conversation.id,
      conversationId: conversation.id,
      type: 'direct',
      name: other?.username || 'Direct message',
      avatar: other?.avatar || null,
      memberCount: conversation.participants.length,
      lastMessage: conversation.messages?.[0] || null,
      user: other || null,
      unreadCount: settings.unreadCount || 0,
      lastReadAt: settings.lastReadAt,
      pinnedAt: settings.pinnedAt,
      mutedUntil: settings.mutedUntil,
      archivedAt: settings.archivedAt,
      lastActivityAt: settings.lastActivityAt || conversation.updatedAt,
    };
  }

  private conversationInclude() {
    return {
      group: { include: { _count: { select: { members: true } } } },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              status: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: { take: 1, orderBy: { createdAt: 'desc' as const } },
    };
  }
}
