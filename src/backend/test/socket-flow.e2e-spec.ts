import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.PRESENCE_OFFLINE_DELAY_MS = '100';

type TestUser = {
  id: string;
  username: string;
  email: string;
  token: string;
};

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function onEvent(payload: T) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

function waitForMatchingEvent<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for matching ${event}`));
    }, timeoutMs);

    function onEvent(payload: T) {
      if (!predicate(payload)) return;

      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    }

    socket.on(event, onEvent);
  });
}

describe('Socket flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = 'Passw0rd!123';
  const registeredEmails: string[] = [];
  const sockets: Socket[] = [];

  function userFixture(label: string, index: number) {
    const normalized = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return {
      username: `${normalized}_${index}_${runId}`.slice(0, 32),
      email: `socket_${normalized}_${index}_${runId}@example.com`,
      password,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    sockets.forEach(socket => socket.disconnect());

    const testUsers = await prisma.user.findMany({
      where: { email: { in: registeredEmails } },
      select: { id: true },
    });
    const userIds = testUsers.map(user => user.id);

    if (userIds.length > 0) {
      const conversationIds = await prisma.userConversation.findMany({
        where: { userId: { in: userIds } },
        select: { conversationId: true },
      }).then(rows => [...new Set(rows.map(row => row.conversationId))]);

      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { conversationId: { in: conversationIds } }] } }),
        prisma.messageReaction.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.pinnedMessage.deleteMany({ where: { pinnedById: { in: userIds } } }),
        prisma.attachment.deleteMany({ where: { uploaderId: { in: userIds } } }),
        prisma.message.deleteMany({ where: { OR: [{ senderId: { in: userIds } }, { conversationId: { in: conversationIds } }] } }),
        prisma.inviteLink.deleteMany({ where: { createdById: { in: userIds } } }),
        prisma.groupMember.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.channelMember.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.userConversation.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.contact.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { userId: { in: userIds } }] } }),
        prisma.blockList.deleteMany({ where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] } }),
        prisma.group.deleteMany({ where: { ownerId: { in: userIds } } }),
        prisma.channel.deleteMany({ where: { ownerId: { in: userIds } } }),
        prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
        prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      ]);
    }

    await app.close();
  });

  async function register(label: string, index: number): Promise<TestUser> {
    const user = userFixture(label, index);
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(user)
      .expect(201);

    registeredEmails.push(user.email);
    return {
      id: response.body.user.id,
      username: response.body.user.username,
      email: response.body.user.email,
      token: response.body.token,
    };
  }

  function connect(token: string) {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  async function connectAndWait(user: TestUser) {
    const socket = connect(user.token);
    await waitForEvent(socket, 'connect');
    return socket;
  }

  it('authenticates sockets and emits message, notification, and typing events', async () => {
    const alice = await register('socket_alice', 0);
    const bob = await register('socket_bob', 1);

    const direct = await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(201);

    const [aliceSocket, bobSocket] = await Promise.all([
      connectAndWait(alice),
      connectAndWait(bob),
    ]);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('joinConversation timed out')), 3000);
      bobSocket.emit('joinConversation', { conversationId: direct.body.id }, (response: any) => {
        clearTimeout(timer);
        try {
          expect(response).toEqual({ ok: true, conversationId: direct.body.id });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    const typingPromise = waitForEvent<any>(bobSocket, 'typing');
    aliceSocket.emit('typing:start', { conversationId: direct.body.id });
    await expect(typingPromise).resolves.toMatchObject({
      conversationId: direct.body.id,
      userId: alice.id,
      username: alice.username,
      isTyping: true,
    });

    const messagePromise = waitForEvent<any>(bobSocket, 'message');
    const notificationPromise = waitForEvent<any>(bobSocket, 'notification');

    await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        conversationId: direct.body.id,
        content: 'socket hello',
        clientId: `socket-message-${runId}`,
      })
      .expect(201);

    const [message, notification] = await Promise.all([messagePromise, notificationPromise]);
    expect(message).toMatchObject({
      conversationId: direct.body.id,
      senderId: alice.id,
      content: 'socket hello',
    });
    expect(notification).toMatchObject({
      userId: bob.id,
      conversationId: direct.body.id,
      messageId: message.id,
      title: alice.username,
      body: 'socket hello',
      read: false,
    });
  });

  it('rejects unauthenticated socket connections', async () => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);

    await expect(waitForEvent(socket, 'disconnect')).resolves.toBe('io server disconnect');
  });

  it('keeps users online until their last device disconnects', async () => {
    const alice = await register('presence_alice', 0);
    const observer = await register('presence_observer', 1);
    const observerSocket = await connectAndWait(observer);

    const firstOnlinePromise = waitForMatchingEvent<any>(
      observerSocket,
      'presence:update',
      payload => payload.userId === alice.id && payload.status === 'online',
    );
    const firstDevice = await connectAndWait(alice);
    await expect(firstOnlinePromise).resolves.toMatchObject({
      userId: alice.id,
      status: 'online',
    });

    const secondDevice = await connectAndWait(alice);
    secondDevice.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    const stillOnline = await prisma.user.findUnique({
      where: { id: alice.id },
      select: { status: true },
    });
    expect(stillOnline?.status).toBe('online');

    const offlinePromise = waitForMatchingEvent<any>(
      observerSocket,
      'presence:update',
      payload => payload.userId === alice.id && payload.status === 'offline',
    );
    firstDevice.disconnect();
    await expect(offlinePromise).resolves.toMatchObject({
      userId: alice.id,
      status: 'offline',
    });

    const offline = await prisma.user.findUnique({
      where: { id: alice.id },
      select: { status: true },
    });
    expect(offline?.status).toBe('offline');
  });
});
