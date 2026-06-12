import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsIn(['text', 'image', 'file'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientId?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  forwardFromId?: string;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}

export class ToggleReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class GetMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  beforeCreatedAt?: string;

  @IsOptional()
  @IsString()
  beforeId?: string;

  @IsOptional()
  @IsString()
  before?: string;
}

export class SearchMessagesQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ForwardMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientId?: string;
}
