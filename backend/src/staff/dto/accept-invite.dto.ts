import { IsString, IsOptional, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  full_name?: string;
}
