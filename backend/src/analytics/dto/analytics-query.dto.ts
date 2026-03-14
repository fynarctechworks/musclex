import {
  IsOptional,
  IsString,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  organization_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export class RevenueQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['membership', 'personal_training', 'classes', 'retail', 'other'])
  revenue_type?: string;
}

export class MembershipQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  plan_id?: string;
}

export class ClassQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  class_template_id?: string;
}

export class TrainerQueryDto extends AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  trainer_id?: string;
}

export class MemberBehaviorQueryDto {
  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  churn_risk?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  min_engagement?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  max_engagement?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class ReportExportDto {
  @IsIn(['revenue', 'membership', 'attendance', 'trainer', 'inventory', 'daily_metrics'])
  report_type: string;

  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf';

  @IsOptional()
  @IsString()
  organization_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class CampaignAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  campaign_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
