import {
  IsUUID,
  IsDateString,
  IsInt,
  IsString,
  IsOptional,
  IsIn,
  Min,
} from 'class-validator';

export class CreateTrainerSessionDto {
  @IsUUID()
  trainer_id: string;

  @IsUUID()
  member_id: string;

  @IsUUID()
  branch_id: string;

  @IsDateString()
  session_date: string;

  @IsInt()
  @Min(15)
  session_duration: number; // minutes

  @IsOptional()
  @IsString()
  @IsIn([
    'personal_training',
    'group_training',
    'rehab_session',
    'assessment',
  ])
  session_type?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
