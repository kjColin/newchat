import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  async create(@Request() req: any, @Body() body: { conversationId: string; content: string; type?: string }) {
    return this.messagesService.create(body.conversationId, req.user.userId, body.content, body.type);
  }

  @Patch(':messageId')
  async edit(@Request() req: any, @Param('messageId') messageId: string, @Body() body: { content: string }) {
    return this.messagesService.edit(messageId, req.user.userId, body.content);
  }

  @Delete(':messageId')
  async remove(@Request() req: any, @Param('messageId') messageId: string) {
    return this.messagesService.remove(messageId, req.user.userId);
  }

  @Post(':messageId/reactions')
  async react(@Request() req: any, @Param('messageId') messageId: string, @Body() body: { emoji: string }) {
    return this.messagesService.toggleReaction(messageId, req.user.userId, body.emoji);
  }

  @Post(':conversationId/read')
  async markRead(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.messagesService.markRead(conversationId, req.user.userId);
  }

  @Get(':conversationId')
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit: string,
    @Query('before') before: string,
    @Request() req: any,
  ) {
    return this.messagesService.findByConversation(
      conversationId,
      req.user.userId,
      parseInt(limit) || 50,
      before,
    );
  }
}
