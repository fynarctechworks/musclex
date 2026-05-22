import {
  IsUUID,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
} from 'class-validator';

export class TopUpWalletDto {
  @IsUUID()
  member_id: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  created_by?: string;
}

export class AdjustWalletDto {
  @IsUUID()
  member_id: string;

  // money delta (+credit / -debit); use points for point adjustments
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsInt()
  points?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  created_by?: string;
}

export class UpsertLoyaltyConfigDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  points_per_currency?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  redeem_value_per_point?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_redeem_points?: number;
}
