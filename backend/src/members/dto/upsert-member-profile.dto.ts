import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
} from 'class-validator';

export class UpsertMemberProfileDto {
  @IsNumber()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsNumber()
  @IsOptional()
  body_fat_percentage?: number;

  @IsString()
  @IsOptional()
  @IsIn(['weight_loss', 'muscle_gain', 'rehabilitation', 'endurance', 'general_fitness'])
  fitness_goal?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  medical_conditions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergies?: string[];

  @IsString()
  @IsOptional()
  emergency_contact?: string;

  @IsString()
  @IsOptional()
  emergency_phone?: string;

  @IsString()
  @IsOptional()
  blood_group?: string;
}
