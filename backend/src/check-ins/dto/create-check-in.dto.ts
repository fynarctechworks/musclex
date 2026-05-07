import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateCheckInDto {
  @IsUUID()
  @IsOptional()
  member_id?: string;

  @IsString()
  @IsOptional()
  qr_code?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsString()
  checkin_method: string;

  @IsUUID()
  @IsOptional()
  class_id?: string;
}
