import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMemberTagDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AssignTagDto {
  @IsString()
  tag_id: string;
}
