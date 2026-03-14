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
}
