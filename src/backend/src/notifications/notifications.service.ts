import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return notifications.map(notification => this.format(notification));
  }

  async createForMessage(message: any) {
    const participants = await this.prisma.userConversation.findMany({
      where: {
        conversationId: message.conversationId,
        userId: { not: message.senderId },
        OR: [
          { mutedUntil: null },
          { mutedUntil: { lte: new Date() } },
        ],
      },
      include: {
        conversation: {
          include: {
            group: true,
            channel: true,
          },
        },
      },
    });

    if (participants.length === 0) return [];

    const title = this.notificationTitle(message, participants[0].conversation);
    const body = this.notificationBody(message);

    await this.prisma.notification.createMany({
      data: participants.map(participant => ({
        userId: participant.userId,
        conversationId: message.conversationId,
        messageId: message.id,
        title,
        body,
      })),
    });

    const created = await this.prisma.notification.findMany({
      where: {
        messageId: message.id,
        userId: { in: participants.map(participant => participant.userId) },
      },
      orderBy: { createdAt: 'desc' },
    });

    return created.map(notification => this.format(notification));
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: notification.count };
  }

  async markConversationRead(userId: string, conversationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, conversationId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  async clear(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });

    return { deleted: result.count };
  }

  private notificationTitle(message: any, conversation: any) {
    if (conversation.type === 'direct') return message.sender?.username || 'Direct message';
    if (conversation.channel?.name) return conversation.channel.name;
    if (conversation.group?.name) return conversation.group.name;
    return conversation.name || message.sender?.username || 'New message';
  }

  private notificationBody(message: any) {
    const content = message.content?.trim();
    if (content) return content;
    const attachment = message.attachments?.[0];
    if (attachment) return attachment.fileName;
    return 'New message';
  }

  private format(notification: any) {
    return {
      id: notification.id,
      userId: notification.userId,
      conversationId: notification.conversationId,
      messageId: notification.messageId,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt,
      read: Boolean(notification.readAt),
    };
  }
}
