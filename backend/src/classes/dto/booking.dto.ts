import {
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
} from 'class-validator';

export class BookClassDto {
  @IsUUID()
  session_id: string;

  @IsUUID()
  member_id: string;
}

export class CancelBookingDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class MarkAttendanceDto {
  @IsUUID()
  member_id: string;

  @IsString()
  @IsIn(['present', 'late', 'no_show', 'cancelled'])
  attendance_status: string;
}
