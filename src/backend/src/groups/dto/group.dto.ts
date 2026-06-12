import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  members: string[] = [];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class AddGroupMembersDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  members: string[] = [];
}
