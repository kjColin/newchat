import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
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
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const users = [
    {
      username: `a_${runId}`.slice(0, 32),
      email: `e2e_alice_${runId}@example.com`,
      password: 'Passw0rd!123',
    },
    {
      username: `b_${runId}`.slice(0, 32),
      email: `e2e_bob_${runId}@example.com`,
      password: 'Passw0rd!123',
    },
  ];

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
  });

  afterAll(async () => {
    const emails = users.map(user => user.email);
    const testUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = testUsers.map(user => user.id);

    if (userIds.length > 0) {
      const conversationIds = await prisma.userConversation.findMany({
        where: { userId: { in: userIds } },
        select: { conversationId: true },
      }).then(rows => [...new Set(rows.map(row => row.conversationId))]);

      await prisma.$transaction([
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

  async function register(index: number): Promise<TestUser> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(users[index])
      .expect(201);

    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(users[index].email);

    return {
      id: response.body.user.id,
      username: response.body.user.username,
      email: response.body.user.email,
      token: response.body.token,
    };
  }

  it('registers, logs in, creates direct and group chats, and sends messages', async () => {
    const alice = await register(0);
    const bob = await register(1);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: alice.email, password: users[0].password })
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
});
