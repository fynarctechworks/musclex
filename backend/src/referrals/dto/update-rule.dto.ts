import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RuleConditionsDto, RewardActionDto } from './create-rule.dto';

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  campaign_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsInt()
  @IsOptional()
  priority?: number;

  @ValidateNested()
  @Type(() => RuleConditionsDto)
  @IsObject()
  @IsOptional()
  conditions?: RuleConditionsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardActionDto)
  @IsOptional()
  rewards?: RewardActionDto[];

  @IsInt()
  @Min(1)
  @IsOptional()
  max_uses?: number;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_until?: string;
}
