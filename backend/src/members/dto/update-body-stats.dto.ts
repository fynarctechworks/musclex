import {
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class UpdateBodyStatsDto {
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

  @IsNumber()
  @IsOptional()
  arms?: number;

  @IsNumber()
  @IsOptional()
  thighs?: number;

  @IsNumber()
  @IsOptional()
  calves?: number;

  @IsDateString()
  @IsOptional()
  recorded_at?: string;
}
