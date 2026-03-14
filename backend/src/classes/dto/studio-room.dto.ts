import {
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateStudioRoomDto {
  @IsUUID()
  branch_id: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  equipment_available?: string[];
}

export class UpdateStudioRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  equipment_available?: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class CreateRecurringRuleDto {
  @IsUUID()
  template_id: string;

  @IsUUID()
  branch_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  days_of_week: number[];

  @IsString()
  start_time: string;

  @IsInt()
  @Min(10)
  @IsOptional()
  duration_minutes?: number;

  @IsUUID()
  @IsOptional()
  trainer_id?: string;

  @IsUUID()
  @IsOptional()
  studio_id?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsDateString()
  @IsOptional()
  repeat_until?: string;
}
