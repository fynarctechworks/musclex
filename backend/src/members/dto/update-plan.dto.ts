import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PLAN_ACCESS_TYPES } from './create-plan.dto';

export class UpdatePlanDto {
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn([
    'monthly', 'quarterly', 'half_yearly', 'yearly',
    'class_pack', 'custom', 'day_pass', 'corporate',
    'family', 'global_access',
  ])
  @IsOptional()
  plan_type?: string;

  @IsNumber()
  @IsOptional()
  duration_days?: number;

  @IsNumber()
  @IsOptional()
  total_classes?: number;

  @IsNumber()
  @IsOptional()
  max_classes_per_week?: number;

  @IsNumber()
  @IsOptional()
  max_visits?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

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
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  auto_renew_enabled?: boolean;

  // ── Multi-gym access scope ──

  @IsString()
  @IsIn(PLAN_ACCESS_TYPES as unknown as string[])
  @IsOptional()
  access_type?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  tier?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  allowed_branch_ids?: string[];

  @IsString()
  @IsOptional()
  allowed_city?: string;

  @IsObject()
  @IsOptional()
  allowed_hours_json?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  feature_flags?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  branch_price_overrides?: Record<string, number>;
}
