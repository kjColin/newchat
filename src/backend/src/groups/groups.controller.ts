import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  async create(@Request() req: any, @Body() body: { name: string; members: string[] }) {
    return this.groupsService.create(body.name, req.user.userId, body.members);
  }

  @Post('direct')
  async createDirect(@Request() req: any, @Body() body: { userId: string }) {
    return this.groupsService.createDirect(req.user.userId, body.userId);
  }

  @Patch(':conversationId/settings')
  async updateSettings(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: { pinned?: boolean; muted?: boolean; archived?: boolean },
  ) {
    return this.groupsService.updateSettings(conversationId, req.user.userId, body);
  }

  @Patch(':conversationId')
  async updateGroup(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: { name?: string; avatar?: string },
  ) {
    return this.groupsService.updateGroup(conversationId, req.user.userId, body);
  }

  @Get(':conversationId/members')
  async getMembers(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.groupsService.getMembers(conversationId, req.user.userId);
  }

  @Post(':conversationId/members')
  async addMembers(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: { members: string[] },
  ) {
    return this.groupsService.addMembers(conversationId, req.user.userId, body.members || []);
  }

  @Delete(':conversationId/members/:userId')
  async removeMember(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.removeMember(conversationId, req.user.userId, userId);
  }

  @Get()
  async findByUser(@Request() req: any) {
    return this.groupsService.findByUser(req.user.userId);
  }
}
