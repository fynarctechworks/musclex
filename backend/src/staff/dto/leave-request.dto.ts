import {
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  IsIn,
  IsArray,
} from 'class-validator';

export class CreateLeaveRequestDto {
  @IsUUID()
  staff_id: string;

  @IsIn(['sick', 'vacation', 'personal', 'unpaid'])
  leave_type: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  notify_to?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  notify_cc?: string[];
}

export class ReviewLeaveRequestDto {
  @IsIn(['approved', 'rejected'])
  status: string;

  @IsOptional()
  @IsString()
  reviewer_notes?: string;
}
