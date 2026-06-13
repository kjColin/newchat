import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class UpdateCurrentUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}

export class ContactUserDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  alias?: string;
}

export class BlockUserDto {
  @IsString()
  userId: string;
}
