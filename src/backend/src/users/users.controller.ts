import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Get('search')
  async search(@Request() req: any, @Query('q') query = '') {
    return this.usersService.search(query, req.user.userId);
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() data: { username?: string; avatar?: string }) {
    return this.usersService.update(req.user.userId, data);
  }
}
