import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, ...result } = user;
    return result;
  }

  async update(id: string, data: { username?: string; avatar?: string; searchable?: boolean; allowDirectMessages?: boolean }) {
    const username = data.username?.trim();
    const avatar = data.avatar?.trim();
    const updateData = {
      username,
      avatar: data.avatar === undefined ? undefined : avatar || null,
      searchable: data.searchable,
      allowDirectMessages: data.allowDirectMessages,
    };
    if (username !== undefined && (username.length < 2 || username.length > 32)) {
      throw new BadRequestException('Username must be 2-32 characters');
    }

    if (username !== undefined) {
      const existing = await this.prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Username already exists');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    const { password, ...result } = user;
    return result;
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status, lastSeen: new Date() },
    });
  }

  async search(query: string, currentUserId: string) {
    const q = query.trim();
    if (q.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        searchable: true,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
        lastSeen: true,
      },
    });

    return this.withRelationshipFlags(currentUserId, users);
  }

  async listContacts(ownerId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: this.publicUserSelect() },
      },
    });

    const blocked = await this.blockedIds(ownerId, contacts.map(contact => contact.userId));
    return contacts.map(contact => ({
      user: {
        ...contact.user,
        isContact: true,
        isBlocked: blocked.has(contact.userId),
      },
      alias: contact.alias,
      createdAt: contact.createdAt,
    }));
  }

  async addContact(ownerId: string, userId: string, alias?: string) {
    if (ownerId === userId) throw new BadRequestException('Cannot add yourself');
    await this.ensureUserExists(userId);

    const blocked = await this.prisma.blockList.findUnique({
      where: { blockerId_blockedId: { blockerId: ownerId, blockedId: userId } },
    });
    if (blocked) throw new BadRequestException('Cannot add blocked user as contact');

    await this.prisma.contact.upsert({
      where: { ownerId_userId: { ownerId, userId } },
      update: { alias: alias?.trim() || null },
      create: { ownerId, userId, alias: alias?.trim() || null },
    });

    return this.listContacts(ownerId);
  }

  async removeContact(ownerId: string, userId: string) {
    await this.prisma.contact.delete({
      where: { ownerId_userId: { ownerId, userId } },
    }).catch(() => undefined);

    return this.listContacts(ownerId);
  }

  async listBlockedUsers(blockerId: string) {
    const blocks = await this.prisma.blockList.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: { select: this.publicUserSelect() },
      },
    });

    return blocks.map(block => ({
      user: {
        ...block.blocked,
        isContact: false,
        isBlocked: true,
      },
      createdAt: block.createdAt,
    }));
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('Cannot block yourself');
    await this.ensureUserExists(blockedId);

    await this.prisma.$transaction([
      this.prisma.contact.deleteMany({
        where: {
          OR: [
            { ownerId: blockerId, userId: blockedId },
            { ownerId: blockedId, userId: blockerId },
          ],
        },
      }),
      this.prisma.blockList.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        update: {},
        create: { blockerId, blockedId },
      }),
    ]);

    return this.listBlockedUsers(blockerId);
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.blockList.delete({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    }).catch(() => undefined);

    return this.listBlockedUsers(blockerId);
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }

  private publicUserSelect() {
    return {
      id: true,
      username: true,
      email: true,
      avatar: true,
      status: true,
      lastSeen: true,
      searchable: true,
      allowDirectMessages: true,
    };
  }

  private async withRelationshipFlags(currentUserId: string, users: any[]) {
    const userIds = users.map(user => user.id);
    const [contacts, blocked] = await Promise.all([
      this.prisma.contact.findMany({
        where: { ownerId: currentUserId, userId: { in: userIds } },
        select: { userId: true },
      }),
      this.prisma.blockList.findMany({
        where: { blockerId: currentUserId, blockedId: { in: userIds } },
        select: { blockedId: true },
      }),
    ]);

    const contactIds = new Set(contacts.map(contact => contact.userId));
    const blockedIds = new Set(blocked.map(block => block.blockedId));
    return users.map(user => ({
      ...user,
      isContact: contactIds.has(user.id),
      isBlocked: blockedIds.has(user.id),
    }));
  }

  private async blockedIds(blockerId: string, userIds: string[]) {
    if (userIds.length === 0) return new Set<string>();
    const blocked = await this.prisma.blockList.findMany({
      where: { blockerId, blockedId: { in: userIds } },
      select: { blockedId: true },
    });
    return new Set(blocked.map(block => block.blockedId));
  }
}
