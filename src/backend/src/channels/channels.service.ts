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
