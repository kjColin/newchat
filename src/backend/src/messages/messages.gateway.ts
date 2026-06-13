import { OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { getCorsOrigins, getJwtSecret, getPresenceOfflineDelayMs } from '../common/config';

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly offlineDelayMs = getPresenceOfflineDelayMs();
  private readonly activeSocketsByUser = new Map<string, Set<string>>();
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: getJwtSecret(),
      });
      client.data.userId = payload.sub;
      await this.markUserOnline(payload.sub, client.id);

      const conversations = await this.prisma.userConversation.findMany({
        where: { userId: payload.sub },
        select: { conversationId: true },
      });

      conversations.forEach(({ conversationId }) => {
        client.join(this.roomName(conversationId));
      });

      this.server?.emit('presence:update', {
        userId: payload.sub,
        status: 'online',
        lastSeen: new Date().toISOString(),
      });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    this.markSocketDisconnected(userId, client.id);
  }

  onModuleDestroy() {
    this.offlineTimers.forEach(timer => clearTimeout(timer));
    this.offlineTimers.clear();
    this.activeSocketsByUser.clear();
  }

  @SubscribeMessage('joinConversation')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = client.data.userId;
    const conversationId = body?.conversationId;
    if (!userId || !conversationId) return { ok: false };

    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });

    if (!participant) return { ok: false };

    client.join(this.roomName(conversationId));
    return { ok: true, conversationId };
  }

  @SubscribeMessage('typing:start')
  async startTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    await this.emitTyping(client, body?.conversationId, true);
  }

  @SubscribeMessage('typing:stop')
  async stopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    await this.emitTyping(client, body?.conversationId, false);
  }

  emitMessage(message: { conversationId: string }) {
    this.server?.to(this.roomName(message.conversationId)).emit('message', message);
  }

  emitMessageUpdated(message: { conversationId: string }) {
    this.server?.to(this.roomName(message.conversationId)).emit('message:updated', message);
  }

  emitMessageDeleted(message: { conversationId: string }) {
    this.server?.to(this.roomName(message.conversationId)).emit('message:deleted', message);
  }

  emitReaction(message: { conversationId: string }) {
    this.server?.to(this.roomName(message.conversationId)).emit('message:reaction', message);
  }

  emitRead(payload: { conversationId: string; userId: string; lastReadAt: string }) {
    this.server?.to(this.roomName(payload.conversationId)).emit('message:read', payload);
  }

  emitPinnedMessages(payload: { conversationId: string; pinnedMessages: any[] }) {
    this.server?.to(this.roomName(payload.conversationId)).emit('message:pinned', payload);
  }

  emitNotification(userId: string, notification: any) {
    const socketIds = this.activeSocketsByUser.get(userId);
    socketIds?.forEach(socketId => {
      this.server?.to(socketId).emit('notification', notification);
    });
  }

  private async emitTyping(client: Socket, conversationId: string | undefined, isTyping: boolean) {
    const userId = client.data.userId;
    if (!userId || !conversationId) return;

    const participant = await this.prisma.userConversation.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!participant) return;

    client.to(this.roomName(conversationId)).emit('typing', {
      conversationId,
      userId,
      username: participant.user.username,
      isTyping,
    });
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return undefined;
  }

  private roomName(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private async markUserOnline(userId: string, socketId: string) {
    const existingTimer = this.offlineTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.offlineTimers.delete(userId);
    }

    const sockets = this.activeSocketsByUser.get(userId) || new Set<string>();
    sockets.add(socketId);
    this.activeSocketsByUser.set(userId, sockets);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'online', lastSeen: new Date() },
    });
  }

  private markSocketDisconnected(userId: string, socketId: string) {
    const sockets = this.activeSocketsByUser.get(userId);
    if (!sockets) return;

    sockets.delete(socketId);
    if (sockets.size > 0) return;

    this.activeSocketsByUser.delete(userId);
    const timer = setTimeout(async () => {
      if (this.activeSocketsByUser.has(userId)) return;

      const lastSeen = new Date();
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'offline', lastSeen },
      }).catch(() => undefined);

      this.server?.emit('presence:update', {
        userId,
        status: 'offline',
        lastSeen: lastSeen.toISOString(),
      });
      this.offlineTimers.delete(userId);
    }, this.offlineDelayMs);
    timer.unref?.();

    this.offlineTimers.set(userId, timer);
  }
}
