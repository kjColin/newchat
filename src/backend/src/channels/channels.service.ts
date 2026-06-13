import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
  ) {}

  async create(ownerId: string, data: { name: string; description?: string; avatar?: string }) {
    const name = data.name.trim();
    const description = data.description?.trim();
    if (!name) throw new BadRequestException('Channel name is required');

    return this.prisma.$transaction(async prisma => {
      const conversation = await prisma.conversation.create({
        data: { type: 'channel', name },
      });

      const channel = await prisma.channel.create({
        data: {
          name,
          description: description || null,
          avatar: data.avatar?.trim() || null,
          ownerId,
          conversationId: conversation.id,
          members: {
            create: [{ userId: ownerId, role: 'owner' }],
          },
        },
        include: {
          conversation: true,
          _count: { select: { members: true } },
        },
      });

      await prisma.userConversation.create({
        data: { userId: ownerId, conversationId: conversation.id },
      });

      return this.conversationsService.formatChannelConversation(
        channel,
        channel.conversation,
        channel._count.members,
        { role: 'owner' },
      );
    });
  }

  async update(conversationId: string, userId: string, data: { name?: string; description?: string; avatar?: string }) {
    const channel = await this.getManageableChannel(conversationId, userId);
    const name = data.name?.trim();
    const description = data.description?.trim();
    if (name !== undefined && name.length === 0) throw new BadRequestException('Channel name is required');

    const updated = await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: name || undefined,
        description: data.description === undefined ? undefined : description || null,
        avatar: data.avatar === undefined ? undefined : data.avatar.trim() || null,
        conversation: name ? { update: { name } } : undefined,
      },
      include: {
        conversation: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
        _count: { select: { members: true } },
      },
    });

    return this.conversationsService.formatChannelConversation(
      updated,
      updated.conversation,
      updated._count.members,
      { role: channel.members[0]?.role || 'subscriber' },
    );
  }

  async discover(userId: string, query = '') {
    const q = query.trim();
    const channels = await this.prisma.channel.findMany({
      where: q
        ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
        : undefined,
      orderBy: [
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      take: 30,
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: { select: { members: true } },
      },
    });

    return channels.map(channel => ({
      id: channel.id,
      channelId: channel.id,
      conversationId: channel.conversationId,
      name: channel.name,
      description: channel.description,
      avatar: channel.avatar,
      memberCount: channel._count.members,
      isSubscribed: channel.members.length > 0,
      role: channel.members[0]?.role || null,
    }));
  }

  async subscribe(conversationId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { conversationId },
      include: {
        conversation: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
        members: { where: { userId }, select: { role: true } },
        _count: { select: { members: true } },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.members[0]) {
      return this.conversationsService.formatChannelConversation(
        channel,
        channel.conversation,
        channel._count.members,
        { role: channel.members[0].role },
      );
    }

    const subscribed = await this.prisma.$transaction(async prisma => {
      await prisma.channelMember.create({
        data: {
          channelId: channel.id,
          userId,
          role: 'subscriber',
        },
      });

      await prisma.userConversation.upsert({
        where: { userId_conversationId: { userId, conversationId } },
        update: {
          archivedAt: null,
        },
        create: { userId, conversationId },
      });

      return prisma.channel.findUnique({
        where: { id: channel.id },
        include: {
          conversation: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
          _count: { select: { members: true } },
        },
      });
    });

    if (!subscribed) throw new NotFoundException('Channel not found');

    return this.conversationsService.formatChannelConversation(
      subscribed,
      subscribed.conversation,
      subscribed._count.members,
      { role: 'subscriber' },
    );
  }

  async unsubscribe(conversationId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { conversationId },
      include: { members: { where: { userId }, select: { id: true, role: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const membership = channel.members[0];
    if (!membership) throw new ForbiddenException('Not in channel');
    if (membership.role === 'owner') {
      throw new ForbiddenException('Channel owner cannot leave the channel');
    }

    await this.prisma.$transaction([
      this.prisma.channelMember.delete({ where: { id: membership.id } }),
      this.prisma.userConversation.deleteMany({
        where: { userId, conversationId },
      }),
    ]);

    return { conversationId, channelId: channel.id };
  }

  async getMembers(conversationId: string, userId: string) {
    const channel = await this.getChannelForMember(conversationId, userId);
    return this.prisma.channelMember.findMany({
      where: { channelId: channel.id },
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

  private async getChannelForMember(conversationId: string, userId: string) {
    const membership = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    if (!membership) throw new ForbiddenException('Not in channel');

    const channel = await this.prisma.channel.findUnique({
      where: { conversationId },
      include: { members: { where: { userId } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  private async getManageableChannel(conversationId: string, userId: string) {
    const channel = await this.getChannelForMember(conversationId, userId);
    const role = channel.members[0]?.role;
    if (!role || !['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Admin permission required');
    }
    return channel;
  }
}
