import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { CreateDirectConversationDto, UpdateConversationSettingsDto } from './dto/conversation.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  async findByUser(@Request() req: any) {
    return this.conversationsService.findByUser(req.user.userId);
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
}
