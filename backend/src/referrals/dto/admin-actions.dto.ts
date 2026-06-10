import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  IsNumber,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';

export class FraudQueueFilterDto {
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsIn(['pending', 'reviewed_ok', 'confirmed_fraud'])
  review_status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ReviewSignalDto {
  @IsIn(['reviewed_ok', 'confirmed_fraud'])
  decision: 'reviewed_ok' | 'confirmed_fraud';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ForceTransitionDto {
  @IsString()
  to_status: string;

  @IsString()
  @MinLength(5)
  reason: string;
}

export class RevokeRewardDto {
  @IsString()
  @MinLength(5)
  reason: string;
}

export class FreezeWalletDto {
  @IsString()
  @MinLength(5)
  reason: string;
}

export class ManualAdjustmentDto {
  @IsUUID()
  studio_id: string;

  /** signed: positive = credit, negative = debit */
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @MinLength(5)
  reason: string;
}
