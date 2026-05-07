import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePlanDto {
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn([
    'monthly', 'quarterly', 'half_yearly', 'yearly',
    'class_pack', 'custom', 'day_pass', 'corporate',
    'family', 'global_access',
  ])
  plan_type: string;

  @Transform(({ value }) => value !== undefined && value !== '' ? Number(value) : undefined)
  @IsNumber()
  @IsOptional()
  duration_days?: number;

  @Transform(({ value }) => value !== undefined && value !== '' ? Number(value) : undefined)
  @IsNumber()
  @IsOptional()
  total_classes?: number;

  @Transform(({ value }) => value !== undefined && value !== '' ? Number(value) : undefined)
  @IsNumber()
  @IsOptional()
  max_classes_per_week?: number;

  @Transform(({ value }) => value !== undefined && value !== '' ? Number(value) : undefined)
  @IsNumber()
  @IsOptional()
  max_visits?: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  multi_branch_access?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  grace_period_days?: number;

  @IsBoolean()
  @IsOptional()
  auto_renew_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @Transform(({ value }) => value !== undefined && value !== '' ? Number(value) : undefined)
  @IsNumber()
  @IsOptional()
  yearly_price?: number;
}
