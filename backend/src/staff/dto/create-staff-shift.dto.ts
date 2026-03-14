import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateStaffShiftDto {
  @IsUUID()
  staff_id: string;

  @IsUUID()
  branch_id: string;

  @IsDateString()
  shift_date: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time must be HH:mm format' })
  start_time: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'end_time must be HH:mm format' })
  end_time: string;

  @IsOptional()
  @IsIn(['regular', 'overtime', 'split'])
  shift_type?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStaffShiftDto {
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time must be HH:mm format' })
  start_time?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'end_time must be HH:mm format' })
  end_time?: string;

  @IsOptional()
  @IsIn(['regular', 'overtime', 'split'])
  shift_type?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
