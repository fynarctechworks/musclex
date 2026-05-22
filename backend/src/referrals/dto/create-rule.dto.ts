import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  IsIn,
  IsNumber,
  Min,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Conditions ────────────────────────────────────────────────────

export class RuleConditionsDto {
  /** Match only these subscription plan DB IDs. Empty = any plan. */
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  plan_ids?: string[];

  /** Match only these billing cycles. Empty = any. */
  @IsArray()
  @IsIn(['monthly', 'annual'], { each: true })
  @IsOptional()
  billing_cycles?: ('monthly' | 'annual')[];

  /** Minimum amount paid (in studio's currency) for rule to match */
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_subscription_amount?: number;

  /** ISO-3166-1 alpha-2 country codes. Empty = any. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studio_countries?: string[];

  /**
   * Max number of times a single referrer can receive a reward under this rule.
   * Null = unlimited.
   */
  @IsInt()
  @Min(1)
  @IsOptional()
  max_referrals_per_referrer?: number;
}

// ── Reward Actions ────────────────────────────────────────────────

export class RewardActionDto {
  @IsIn(['extend_subscription', 'account_credit', 'trial_extension', 'wallet_credit'])
  type: 'extend_subscription' | 'account_credit' | 'trial_extension' | 'wallet_credit';

  /** Days to add — required for extend_subscription and trial_extension */
  @IsInt()
  @Min(1)
  @IsOptional()
  days?: number;

  /** Amount — required for account_credit and wallet_credit */
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  /** Currency — required for account_credit and wallet_credit */
  @IsString()
  @IsOptional()
  currency?: string;

  /** Days until wallet credit expires — wallet_credit only. Null = never. */
  @IsInt()
  @Min(1)
  @IsOptional()
  expires_in_days?: number;
}

// ── Create Rule ───────────────────────────────────────────────────

export class CreateRuleDto {
  @IsString()
  name: string;

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
  conditions: RuleConditionsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardActionDto)
  rewards: RewardActionDto[];

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
