import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { BlockUserDto, ContactUserDto, SearchUsersQueryDto, UpdateCurrentUserDto } from './dto/user.dto';

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

  @Get('contacts')
  async contacts(@Request() req: any) {
    return this.usersService.listContacts(req.user.userId);
  }

  @Post('contacts')
  async addContact(@Request() req: any, @Body() body: ContactUserDto) {
    return this.usersService.addContact(req.user.userId, body.userId, body.alias);
  }

  @Delete('contacts/:userId')
  async removeContact(@Request() req: any, @Param('userId') userId: string) {
    return this.usersService.removeContact(req.user.userId, userId);
  }

  @Get('blocks')
  async blocks(@Request() req: any) {
    return this.usersService.listBlockedUsers(req.user.userId);
  }

  @Post('blocks')
  async blockUser(@Request() req: any, @Body() body: BlockUserDto) {
    return this.usersService.blockUser(req.user.userId, body.userId);
  }

  @Delete('blocks/:userId')
  async unblockUser(@Request() req: any, @Param('userId') userId: string) {
    return this.usersService.unblockUser(req.user.userId, userId);
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() data: UpdateCurrentUserDto) {
    return this.usersService.update(req.user.userId, data);
  }
}
