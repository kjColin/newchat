import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

type TestUser = {
  id: string;
  username: string;
  email: string;
  token: string;
};

describe('Chat flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const registeredEmails: string[] = [];

  function userFixture(label: string, index: number) {
    const normalized = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return {
      username: `${normalized}_${index}_${runId}`.slice(0, 32),
      email: `e2e_${normalized}_${index}_${runId}@example.com`,
      password: 'Passw0rd!123',
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
    await app.init();

    prisma = app.get(PrismaService);
    notificationsService = app.get(NotificationsService);
  });

  afterAll(async () => {
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

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(user.email);
    registeredEmails.push(user.email);

    return {
      id: response.body.user.id,
      username: response.body.user.username,
      email: response.body.user.email,
      token: response.body.token,
    };
  }

  it('registers, logs in, creates direct and group chats, and sends messages', async () => {
    const alice = await register('flow_alice', 0);
    const bob = await register('flow_bob', 1);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: alice.email, password: 'Passw0rd!123' })
      .expect(200);
    expect(login.body.user.id).toBe(alice.id);
    expect(login.body.token).toEqual(expect.any(String));

    const direct = await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(201);
    expect(direct.body.type).toBe('direct');
    expect(direct.body.user.id).toBe(bob.id);

    const directMessage = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        conversationId: direct.body.id,
        content: 'hello bob from e2e',
        clientId: `direct-${runId}`,
      })
      .expect(201);
    expect(directMessage.body.content).toBe('hello bob from e2e');

    const group = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: `E2E Group ${runId}`, members: [bob.id] })
      .expect(201);
    expect(group.body.type).toBe('group');
    expect(group.body.memberCount).toBe(2);

    const groupMessage = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        conversationId: group.body.id,
        content: 'hello group from e2e',
        clientId: `group-${runId}`,
      })
      .expect(201);
    expect(groupMessage.body.content).toBe('hello group from e2e');

    const conversations = await request(app.getHttpServer())
      .get('/api/conversations')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    expect(conversations.body.map((item: any) => item.id)).toEqual(expect.arrayContaining([direct.body.id, group.body.id]));
  });

  it('persists notifications, marks them read, and prunes expired notifications', async () => {
    const alice = await register('notify_alice', 0);
    const bob = await register('notify_bob', 1);

    const direct = await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        conversationId: direct.body.id,
        content: 'notification e2e',
        clientId: `notification-${runId}`,
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      conversationId: direct.body.id,
      title: alice.username,
      body: 'notification e2e',
      read: false,
    });

    await request(app.getHttpServer())
      .patch(`/api/notifications/${list.body[0].id}/read`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200)
      .expect(response => {
        expect(response.body.updated).toBe(1);
      });

    const readList = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);
    expect(readList.body[0].read).toBe(true);

    await prisma.notification.create({
      data: {
        userId: bob.id,
        conversationId: direct.body.id,
        title: 'expired',
        body: 'expired body',
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      },
    });

    const cleanup = await notificationsService.cleanup();
    expect(cleanup.deletedExpired).toBeGreaterThanOrEqual(1);

    const remainingExpired = await prisma.notification.count({
      where: {
        userId: bob.id,
        title: 'expired',
      },
    });
    expect(remainingExpired).toBe(0);
  });
});
