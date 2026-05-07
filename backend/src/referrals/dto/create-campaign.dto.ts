import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  max_referrals?: number;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_until?: string;
}
