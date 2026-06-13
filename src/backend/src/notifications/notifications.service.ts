import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import {
  getNotificationCleanupIntervalMs,
  getNotificationMaxPerUser,
  getNotificationRetentionDays,
  getWebPushConfig,
} from '../common/config';

type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly retentionDays = getNotificationRetentionDays();
  private readonly maxPerUser = getNotificationMaxPerUser();
  private readonly cleanupIntervalMs = getNotificationCleanupIntervalMs();
  private readonly webPushConfig = getWebPushConfig();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    if (this.webPushConfig.enabled) {
      webPush.setVapidDetails(
        this.webPushConfig.subject,
        this.webPushConfig.publicKey,
        this.webPushConfig.privateKey,
      );
    }
  }

  onModuleInit() {
    this.runCleanup('startup');
    this.cleanupTimer = setInterval(() => this.runCleanup('scheduled'), this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

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

    await Promise.all(participants.map(participant => this.pruneUserNotifications(participant.userId)));

    const created = await this.prisma.notification.findMany({
      where: {
        messageId: message.id,
        userId: { in: participants.map(participant => participant.userId) },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = created.map(notification => this.format(notification));
    await Promise.all(formatted.map(notification => this.sendPushNotification(notification)));

    return formatted;
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

  getPushPublicKey() {
    return {
      enabled: this.webPushConfig.enabled,
      publicKey: this.webPushConfig.enabled ? this.webPushConfig.publicKey : '',
    };
  }

  async savePushSubscription(userId: string, subscription: PushSubscriptionPayload) {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { subscribed: false };
    }

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return { subscribed: true };
  }

  async removePushSubscription(userId: string, endpoint: string) {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });

    return { deleted: result.count };
  }

  async cleanup() {
    const expired = await this.deleteExpiredNotifications();
    const users = await this.prisma.notification.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    const overflowResults = await Promise.all(
      users.map(user => this.pruneUserNotifications(user.userId)),
    );

    return {
      deletedExpired: expired.deleted,
      deletedOverflow: overflowResults.reduce((sum, result) => sum + result.deleted, 0),
      retentionDays: this.retentionDays,
      maxPerUser: this.maxPerUser,
    };
  }

  private async deleteExpiredNotifications() {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { deleted: result.count, cutoff };
  }

  private async pruneUserNotifications(userId: string) {
    const overflow = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: this.maxPerUser,
      select: { id: true },
    });

    if (overflow.length === 0) return { deleted: 0 };

    const result = await this.prisma.notification.deleteMany({
      where: { id: { in: overflow.map(notification => notification.id) } },
    });

    return { deleted: result.count };
  }

  private runCleanup(reason: string) {
    this.cleanup()
      .then(result => {
        if (result.deletedExpired || result.deletedOverflow) {
          this.logger.log(
            `Notification cleanup (${reason}) deleted ${result.deletedExpired} expired and ${result.deletedOverflow} overflow notifications`,
          );
        }
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Notification cleanup (${reason}) failed: ${message}`);
      });
  }

  private async sendPushNotification(notification: any) {
    if (!this.webPushConfig.enabled) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: notification.userId },
    });
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        conversationId: notification.conversationId,
        messageId: notification.messageId,
      },
    });

    await Promise.all(subscriptions.map(async subscription => {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);
      } catch (error: any) {
        if ([404, 410].includes(error?.statusCode)) {
          await this.prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Web Push delivery failed: ${message}`);
      }
    }));
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
