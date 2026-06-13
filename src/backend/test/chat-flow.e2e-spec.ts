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
  const password = 'Passw0rd!123';
  const registeredEmails: string[] = [];

  function userFixture(label: string, index: number) {
    const normalized = label.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return {
      username: `${normalized}_${index}_${runId}`.slice(0, 32),
      email: `e2e_${normalized}_${index}_${runId}@example.com`,
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
      .send({ email: alice.email, password })
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

  it('uploads an attachment, sends a file message, and lists conversation attachments', async () => {
    const alice = await register('file_alice', 0);
    const bob = await register('file_bob', 1);

    const direct = await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(201);

    const upload = await request(app.getHttpServer())
      .post('/api/files')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', Buffer.from('hello attachment from e2e'), {
        filename: 'e2e-note.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(upload.body).toMatchObject({
      uploaderId: alice.id,
      kind: 'file',
      fileName: 'e2e-note.txt',
      mimeType: 'text/plain',
    });

    const message = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        conversationId: direct.body.id,
        content: '',
        type: 'file',
        attachmentIds: [upload.body.id],
        clientId: `file-${runId}`,
      })
      .expect(201);

    expect(message.body.attachments).toHaveLength(1);
    expect(message.body.attachments[0]).toMatchObject({
      id: upload.body.id,
      fileName: 'e2e-note.txt',
      kind: 'file',
    });

    const attachments = await request(app.getHttpServer())
      .get(`/api/messages/${direct.body.id}/attachments`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);

    expect(attachments.body.attachments.map((item: any) => item.id)).toContain(upload.body.id);
  });

  it('creates invite links, previews them, and joins groups by invite', async () => {
    const alice = await register('invite_alice', 0);
    const bob = await register('invite_bob', 1);

    const group = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: `Invite Group ${runId}`, members: [] })
      .expect(201);

    const invite = await request(app.getHttpServer())
      .post(`/api/groups/${group.body.id}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(201);

    expect(invite.body.code).toEqual(expect.any(String));

    const preview = await request(app.getHttpServer())
      .get(`/api/groups/invites/${invite.body.code}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);
    expect(preview.body.group.conversationId).toBe(group.body.id);
    expect(preview.body.group.memberCount).toBe(1);

    const joined = await request(app.getHttpServer())
      .post(`/api/groups/invites/${invite.body.code}/join`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(201);
    expect(joined.body.id).toBe(group.body.id);
    expect(joined.body.memberCount).toBe(2);

    const links = await request(app.getHttpServer())
      .get(`/api/groups/${group.body.id}/invites`)
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    expect(links.body[0].usedCount).toBe(1);
  });

  it('supports channel discovery and blocks subscriber posting', async () => {
    const owner = await register('channel_owner', 0);
    const subscriber = await register('channel_subscriber', 1);

    const channel = await request(app.getHttpServer())
      .post('/api/channels')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: `E2E Channel ${runId}`,
        description: 'channel discovery coverage',
      })
      .expect(201);

    expect(channel.body.type).toBe('channel');
    expect(channel.body.role).toBe('owner');

    const discover = await request(app.getHttpServer())
      .get('/api/channels/discover')
      .query({ q: `E2E Channel ${runId}` })
      .set('Authorization', `Bearer ${subscriber.token}`)
      .expect(200);
    expect(discover.body[0]).toMatchObject({
      conversationId: channel.body.id,
      isSubscribed: false,
    });

    const subscribed = await request(app.getHttpServer())
      .post(`/api/channels/${channel.body.id}/subscribe`)
      .set('Authorization', `Bearer ${subscriber.token}`)
      .expect(201);
    expect(subscribed.body.role).toBe('subscriber');

    await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${subscriber.token}`)
      .send({
        conversationId: channel.body.id,
        content: 'subscriber should not publish',
        clientId: `channel-denied-${runId}`,
      })
      .expect(403);

    const ownerMessage = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        conversationId: channel.body.id,
        content: 'owner channel post',
        clientId: `channel-owner-${runId}`,
      })
      .expect(201);
    expect(ownerMessage.body.content).toBe('owner channel post');
  });

  it('enforces search visibility and direct-message privacy settings', async () => {
    const alice = await register('privacy_alice', 0);
    const bob = await register('privacy_bob', 1);

    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ searchable: false, allowDirectMessages: false })
      .expect(200);

    const hiddenSearch = await request(app.getHttpServer())
      .get('/api/users/search')
      .query({ q: bob.username })
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    expect(hiddenSearch.body.map((user: any) => user.id)).not.toContain(bob.id);

    await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/users/contacts')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ userId: alice.id })
      .expect(201);

    const direct = await request(app.getHttpServer())
      .post('/api/conversations/direct')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ userId: bob.id })
      .expect(201);
    expect(direct.body.type).toBe('direct');
    expect(direct.body.user.id).toBe(bob.id);
  });
});
