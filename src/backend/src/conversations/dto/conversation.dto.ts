import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDirectConversationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class UpdateConversationSettingsDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
