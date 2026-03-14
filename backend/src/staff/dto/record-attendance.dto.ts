import { IsUUID, IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

export class RecordAttendanceDto {
  @IsUUID()
  staff_id: string;

  @IsUUID()
  branch_id: string;

  @IsOptional()
  @IsString()
  @IsIn(['biometric', 'qr', 'manual', 'mobile'])
  method?: string;

  @IsOptional()
  @IsDateString()
  check_in_time?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
