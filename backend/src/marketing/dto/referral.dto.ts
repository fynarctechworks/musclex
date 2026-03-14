import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsIn,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateReferralProgramDto {
  @IsString()
  program_name: string;

  @IsString()
  @IsIn(['discount', 'free_days', 'cash', 'free_class'])
  reward_type: string;

  @IsNumber()
  @Min(0)
  reward_value: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  min_referrals?: number;

  @IsInt()
  @IsOptional()
  max_rewards?: number;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsUUID()
  @IsOptional()
  organization_id?: string;
}

export class UpdateReferralProgramDto {
  @IsString()
  @IsOptional()
  program_name?: string;

  @IsString()
  @IsIn(['discount', 'free_days', 'cash', 'free_class'])
  @IsOptional()
  reward_type?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reward_value?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  min_referrals?: number;

  @IsInt()
  @IsOptional()
  max_rewards?: number;

  @IsString()
  @IsIn(['active', 'paused', 'ended'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;
}
