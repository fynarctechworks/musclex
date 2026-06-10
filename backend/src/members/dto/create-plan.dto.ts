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
import { Transform } from 'class-transformer';

/**
 * Plan access types — must stay in sync with backend AccessScopeResolver.
 * single_branch is the default and preserves pre-multi-gym behavior.
 */
export const PLAN_ACCESS_TYPES = [
  'single_branch',
  'multi_branch',
  'all_access',
  'city_access',
  'time_based',
  'class_only',
] as const;

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

  // ── Multi-gym access scope (Phase 1+ of cross-branch architecture) ──

  @IsString()
  @IsIn(PLAN_ACCESS_TYPES as unknown as string[])
  @IsOptional()
  access_type?: string;

  /** Free-text tier label chosen by the gym (e.g. "Elite", "Student", "Founders Club"). */
  @IsString()
  @MaxLength(40)
  @IsOptional()
  tier?: string;

  /** UUIDs of branches included in a multi_branch plan. Ignored for other access_types. */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  allowed_branch_ids?: string[];

  /** City name (case-insensitive) for city_access plans. */
  @IsString()
  @IsOptional()
  allowed_city?: string;

  /** Time window for time_based plans: { start: "06:00", end: "10:00", days?: [1,2,3,4,5] } */
  @IsObject()
  @IsOptional()
  allowed_hours_json?: Record<string, unknown>;

  /** Free-form feature flags ({ personal_training: true, spa: false }). */
  @IsObject()
  @IsOptional()
  feature_flags?: Record<string, unknown>;

  /** Per-branch price overrides: { "<branch_uuid>": 1499.00 }. */
  @IsObject()
  @IsOptional()
  branch_price_overrides?: Record<string, number>;
}
