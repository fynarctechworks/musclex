import { IsString, IsUUID, IsOptional, IsBoolean, MaxLength } from 'class-validator';

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

  /** Idempotency key. If absent, the server generates one. */
  @IsUUID()
  @IsOptional()
  client_event_id?: string;

  /** Where the request originated. Defaults to 'staff_desktop'. */
  @IsString()
  @IsOptional()
  source?: string;

  /** Staff override flag — must be paired with a reason. Permission-gated upstream. */
  @IsBoolean()
  @IsOptional()
  override_authorized?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  override_reason?: string;
}
