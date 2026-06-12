import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationsService } from '../conversations/conversations.service';
import { CreateDirectConversationDto, UpdateConversationSettingsDto } from '../conversations/dto/conversation.dto';
import { AddGroupMembersDto, CreateGroupDto, UpdateGroupDto } from './dto/group.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private groupsService: GroupsService,
    private conversationsService: ConversationsService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() body: CreateGroupDto) {
    return this.groupsService.create(body.name, req.user.userId, body.members);
  }

  @Post('direct')
  async createDirect(@Request() req: any, @Body() body: CreateDirectConversationDto) {
    return this.conversationsService.createDirect(req.user.userId, body.userId);
  }

  @Patch(':conversationId/settings')
  async updateSettings(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateConversationSettingsDto,
  ) {
    return this.conversationsService.updateSettings(conversationId, req.user.userId, body);
  }

  @Patch(':conversationId')
  async updateGroup(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateGroupDto,
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
    @Body() body: AddGroupMembersDto,
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
    return this.conversationsService.findByUser(req.user.userId);
  }
}
