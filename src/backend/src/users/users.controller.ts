import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { SearchUsersQueryDto, UpdateCurrentUserDto } from './dto/user.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Get('search')
  async search(@Request() req: any, @Query() query: SearchUsersQueryDto) {
    return this.usersService.search(query.q || '', req.user.userId);
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() data: UpdateCurrentUserDto) {
    return this.usersService.update(req.user.userId, data);
  }
}
