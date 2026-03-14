import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateBodyStatsDto {
  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsNumber()
  @IsOptional()
  body_fat?: number;

  @IsNumber()
  @IsOptional()
  muscle_mass?: number;

  @IsNumber()
  @IsOptional()
  bmi?: number;

  @IsNumber()
  @IsOptional()
  chest?: number;

  @IsNumber()
  @IsOptional()
  waist?: number;

  @IsNumber()
  @IsOptional()
  hips?: number;

  @IsDateString()
  @IsOptional()
  recorded_at?: string;
}
