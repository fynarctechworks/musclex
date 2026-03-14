import { IsArray, ValidateNested, IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class OfflineCheckInDto {
  @IsUUID()
  member_id: string;

  @IsString()
  @IsOptional()
  qr_code?: string;

  @IsUUID()
  branch_id: string;

  @IsString()
  checkin_method: string;

  @IsDateString()
  checked_in_at: string;

  @IsUUID()
  @IsOptional()
  class_id?: string;
}

export class SyncCheckInsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineCheckInDto)
  check_ins: OfflineCheckInDto[];
}
