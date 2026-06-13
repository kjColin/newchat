import { Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async list(@Request() req: any) {
    return this.notificationsService.list(req.user.userId);
  }

  @Patch(':notificationId/read')
  async markRead(@Request() req: any, @Param('notificationId') notificationId: string) {
    return this.notificationsService.markRead(req.user.userId, notificationId);
  }

  @Post('read-all')
  async markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Post('conversations/:conversationId/read')
  async markConversationRead(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.notificationsService.markConversationRead(req.user.userId, conversationId);
  }

  @Delete()
  async clear(@Request() req: any) {
    return this.notificationsService.clear(req.user.userId);
  }
}
