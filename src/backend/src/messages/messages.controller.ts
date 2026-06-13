import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateMessageDto,
  EditMessageDto,
  ForwardMessageDto,
  GetMessagesQueryDto,
  ListAttachmentsQueryDto,
  ListLinksQueryDto,
  SearchMessagesQueryDto,
  ToggleReactionDto,
} from './dto/message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  async create(@Request() req: any, @Body() body: CreateMessageDto) {
    return this.messagesService.create(body.conversationId, req.user.userId, body);
  }

  @Get(':conversationId/search')
  async search(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: SearchMessagesQueryDto,
  ) {
    return this.messagesService.search(conversationId, req.user.userId, query.q, query.limit || 20);
  }

  @Get(':conversationId/attachments')
  async listAttachments(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: ListAttachmentsQueryDto,
  ) {
    return this.messagesService.listAttachments(conversationId, req.user.userId, {
      kind: query.kind,
      limit: query.limit || 40,
      beforeCreatedAt: query.beforeCreatedAt,
      beforeId: query.beforeId,
    });
  }

  @Get(':conversationId/links')
  async listLinks(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: ListLinksQueryDto,
  ) {
    return this.messagesService.listLinks(conversationId, req.user.userId, {
      limit: query.limit || 40,
      beforeCreatedAt: query.beforeCreatedAt,
      beforeId: query.beforeId,
    });
  }

  @Get(':conversationId/pinned')
  async listPinned(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.messagesService.listPinned(conversationId, req.user.userId);
  }

  @Post(':messageId/pin')
  async pinMessage(@Request() req: any, @Param('messageId') messageId: string) {
    return this.messagesService.pinMessage(messageId, req.user.userId);
  }

  @Delete(':conversationId/pinned/:messageId')
  async unpinMessage(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.unpinMessage(conversationId, messageId, req.user.userId);
  }

  @Post(':messageId/forward')
  async forward(@Request() req: any, @Param('messageId') messageId: string, @Body() body: ForwardMessageDto) {
    return this.messagesService.forward(messageId, req.user.userId, body.conversationId, body.clientId);
  }

  @Patch(':messageId')
  async edit(@Request() req: any, @Param('messageId') messageId: string, @Body() body: EditMessageDto) {
    return this.messagesService.edit(messageId, req.user.userId, body.content);
  }

  @Delete(':messageId')
  async remove(@Request() req: any, @Param('messageId') messageId: string) {
    return this.messagesService.remove(messageId, req.user.userId);
  }

  @Post(':messageId/reactions')
  async react(@Request() req: any, @Param('messageId') messageId: string, @Body() body: ToggleReactionDto) {
    return this.messagesService.toggleReaction(messageId, req.user.userId, body.emoji);
  }

  @Post(':conversationId/read')
  async markRead(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.messagesService.markRead(conversationId, req.user.userId);
  }

  @Get(':conversationId')
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesQueryDto,
    @Request() req: any,
  ) {
    return this.messagesService.findByConversation(
      conversationId,
      req.user.userId,
      query.limit || 50,
      {
        beforeCreatedAt: query.beforeCreatedAt,
        beforeId: query.beforeId,
        before: query.before,
      },
    );
  }
}
