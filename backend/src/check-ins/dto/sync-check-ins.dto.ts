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

  /**
   * Stable per-queued-row id minted by the client at enqueue time. Doubles as
   * the idempotency key so a re-sent batch (retry, double "Sync Now", a tab
   * that reconnects twice) cannot create duplicate visits. Optional because
   * rows queued by an older client won't carry one — those still sync, just
   * without dedupe protection.
   */
  @IsUUID()
  @IsOptional()
  client_event_id?: string;
}

export class SyncCheckInsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineCheckInDto)
  check_ins: OfflineCheckInDto[];
}
