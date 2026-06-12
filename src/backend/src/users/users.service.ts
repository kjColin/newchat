import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async update(id: string, data: { username?: string; avatar?: string }) {
    const updateData = {
      username: data.username?.trim(),
      avatar: data.avatar?.trim(),
    };
    if (updateData.username !== undefined && updateData.username.length === 0) {
      throw new BadRequestException('Username cannot be empty');
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

    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
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
  }
}
