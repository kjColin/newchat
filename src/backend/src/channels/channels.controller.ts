import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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

  @Patch(':conversationId')
  async update(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateChannelDto,
  ) {
    return this.channelsService.update(conversationId, req.user.userId, body);
  }

  @Get(':conversationId/members')
  async members(@Request() req: any, @Param('conversationId') conversationId: string) {
    return this.channelsService.getMembers(conversationId, req.user.userId);
  }
}
