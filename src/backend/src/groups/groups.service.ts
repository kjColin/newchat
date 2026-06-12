import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
  ) {}

  async create(name: string, ownerId: string, memberIds: string[]) {
    const groupName = name.trim();
    if (!groupName) throw new BadRequestException('Group name is required');

    const uniqueMemberIds = [...new Set(memberIds)].filter(id => id && id !== ownerId);

    return this.prisma.$transaction(async prisma => {
      const conversation = await prisma.conversation.create({
        data: { type: 'group', name: groupName },
      });

      const group = await prisma.group.create({
        data: {
          name: groupName,
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

      return this.conversationsService.formatGroupConversation(group, group.conversation, group._count.members);
    });
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

    return this.conversationsService.formatGroupConversation(updated, updated.conversation, updated._count.members);
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

}
