import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RevokeSessionDto {
  @IsUUID()
  session_id: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeAllSessionsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
