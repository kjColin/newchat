import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { GroupsModule } from './groups/groups.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    GroupsModule,
    FilesModule,
  ],
})
export class AppModule {}
