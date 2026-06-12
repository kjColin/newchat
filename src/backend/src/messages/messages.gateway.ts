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

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:3001',
      'https://newchat.clnkj.de',
    ],
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

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
        secret: process.env.JWT_SECRET || 'secret',
      });
      client.data.userId = payload.sub;
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { status: 'online', lastSeen: new Date() },
      });

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
}
