import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';

export class CreateClassSessionDto {
  @IsUUID()
  @IsOptional()
  template_id?: string;

  @IsUUID()
  branch_id: string;

  @IsUUID()
  trainer_id: string;

  @IsUUID()
  @IsOptional()
  studio_id?: string;

  @IsString()
  name: string;

  @IsString()
  @IsIn(['cardio', 'strength', 'flexibility', 'mind_body', 'dance', 'martial_arts', 'rehabilitation', 'other'])
  @IsOptional()
  category?: string;

  @IsDateString()
  start_time: string;

  @IsInt()
  @Min(10)
  duration_minutes: number;

  @IsInt()
  @Min(1)
  capacity: number;
}

export class UpdateClassSessionDto {
  @IsUUID()
  @IsOptional()
  trainer_id?: string;

  @IsUUID()
  @IsOptional()
  studio_id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  start_time?: string;

  @IsInt()
  @Min(10)
  @IsOptional()
  duration_minutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  cancellation_reason?: string;
}
