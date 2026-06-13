import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  async create(@Request() req: any, @Body() body: CreateChannelDto) {
    return this.channelsService.create(req.user.userId, body);
  }

  @Get('discover')
  async discover(@Request() req: any, @Query('q') query = '') {
    return this.channelsService.discover(req.user.userId, query);
  }

  @Patch(':conversationId')
  async update(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateChannelDto,
  ) {
    return this.channelsService.update(conversationId, req.user.userId, body);
  }

  @Post(':conversationId/subscribe')
  async subscribe(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.channelsService.subscribe(conversationId, req.user.userId);
  }

  @Delete(':conversationId/subscribe')
  async unsubscribe(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.channelsService.unsubscribe(conversationId, req.user.userId);
  }

  @Get(':conversationId/members')
  async members(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.channelsService.getMembers(conversationId, req.user.userId);
  }
}
