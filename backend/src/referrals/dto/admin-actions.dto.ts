import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  IsNumber,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FraudQueueFilterDto {
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsIn(['pending', 'reviewed_ok', 'confirmed_fraud'])
  review_status?: string;

  // @Type is required on query-string numbers: the global ValidationPipe sets
  // `transform: true` but NOT `enableImplicitConversion`, so without it the
  // string "100" fails @IsInt() and the whole request 400s.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
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

  /** signed: positive = credit, negative = debit. Bounded to a sane range so a
   *  single manual adjustment can never move an unbounded amount of money. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1_000_000)
  @Max(1_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @MinLength(5)
  reason: string;
}
