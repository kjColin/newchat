import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, ownerId: string, memberIds: string[]) {
    const uniqueMemberIds = [...new Set(memberIds)].filter(id => id !== ownerId);

    return this.prisma.$transaction(async prisma => {
      const conversation = await prisma.conversation.create({
        data: { type: 'group', name },
      });

      const group = await prisma.group.create({
        data: {
          name,
          ownerId,
          conversationId: conversation.id,
          members: {
            create: [
              { userId: ownerId, role: 'owner' },
              ...uniqueMemberIds.map(id => ({ userId: id, role: 'member' })),
            ],
          },
        },
        include: {
          conversation: true,
          members: { include: { user: true } },
          _count: { select: { members: true } },
        },
      });

      await prisma.userConversation.createMany({
        data: [
          { userId: ownerId, conversationId: conversation.id },
          ...uniqueMemberIds.map(id => ({ userId: id, conversationId: conversation.id })),
        ],
      });

      return this.formatGroupConversation(group, group.conversation, group._count.members);
    });
  }

  async createDirect(userId: string, targetUserId: string) {
    const existing = await this.prisma.conversation.findMany({
      where: {
        type: 'direct',
        participants: {
          some: { userId },
        },
      },
      include: {
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
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
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
      include: {
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
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    return this.formatDirectConversation(conversation, userId);
  }

  async findByUser(userId: string) {
    const conversations = await this.prisma.userConversation.findMany({
      where: { userId, archivedAt: null },
      include: {
        conversation: {
          include: {
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
            messages: { take: 1, orderBy: { createdAt: 'desc' } },
          },
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

  async updateGroup(conversationId: string, userId: string, data: { name?: string; avatar?: string }) {
    const group = await this.getManageableGroup(conversationId, userId);
    const name = data.name?.trim();
    if (name !== undefined && name.length === 0) throw new BadRequestException('Group name is required');

    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: {
        name: name || undefined,
        avatar: data.avatar,
        conversation: name ? { update: { name } } : undefined,
      },
      include: {
        conversation: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
        _count: { select: { members: true } },
      },
    });

    return this.formatGroupConversation(updated, updated.conversation, updated._count.members);
  }

  async getMembers(conversationId: string, userId: string) {
    const group = await this.getGroupForParticipant(conversationId, userId);

    return this.prisma.groupMember.findMany({
      where: { groupId: group.id },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
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
    });
  }

  async addMembers(conversationId: string, userId: string, memberIds: string[]) {
    const group = await this.getManageableGroup(conversationId, userId);
    const uniqueMemberIds = [...new Set(memberIds)].filter(Boolean);

    await this.prisma.$transaction(async prisma => {
      await prisma.groupMember.createMany({
        data: uniqueMemberIds.map(memberId => ({ userId: memberId, groupId: group.id })),
        skipDuplicates: true,
      });

      await prisma.userConversation.createMany({
        data: uniqueMemberIds.map(memberId => ({ userId: memberId, conversationId })),
        skipDuplicates: true,
      });
    });

    return this.getMembers(conversationId, userId);
  }

  async removeMember(conversationId: string, requesterId: string, memberId: string) {
    const group = await this.getGroupForParticipant(conversationId, requesterId);
    const requester = group.members.find(member => member.userId === requesterId);
    const target = group.members.find(member => member.userId === memberId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') throw new ForbiddenException('Owner cannot be removed');

    const canRemove = requesterId === memberId || requester?.role === 'owner' || requester?.role === 'admin';
    if (!canRemove) throw new ForbiddenException('Not allowed to remove member');

    await this.prisma.$transaction(async prisma => {
      await prisma.groupMember.delete({
        where: { userId_groupId: { userId: memberId, groupId: group.id } },
      });
      await prisma.userConversation.delete({
        where: { userId_conversationId: { userId: memberId, conversationId } },
      }).catch(() => undefined);
    });

    return this.getMembers(conversationId, requesterId);
  }

  private async getGroupForParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    if (!participant) throw new ForbiddenException('Not in conversation');

    const group = await this.prisma.group.findUnique({
      where: { conversationId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async getManageableGroup(conversationId: string, userId: string) {
    const group = await this.getGroupForParticipant(conversationId, userId);
    const member = group.members.find(item => item.userId === userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Admin permission required');
    }

    return group;
  }

  private formatGroupConversation(group: any, conversation: any, memberCount: number, settings: any = {}) {
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
}
