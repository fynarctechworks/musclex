import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsIn(['percentage', 'fixed'])
  discount_type: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_purchase?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount?: number;

  @IsDateString()
  valid_from: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsNumber()
  max_uses?: number;

  @IsOptional()
  @IsIn(['membership', 'class', 'personal_training', 'all'])
  applicable_to?: string;
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsNumber()
  max_uses?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateTaxRateDto {
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  tax_name: string;

  @IsNumber()
  @Min(0)
  rate: number;
}

export class UpdateTaxRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreateGatewayConfigDto {
  @IsIn(['razorpay', 'stripe'])
  gateway_name: string;

  @IsString()
  api_key: string;

  @IsString()
  secret_key: string;

  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @IsOptional()
  @IsBoolean()
  is_test_mode?: boolean;
}

export class UpdateGatewayConfigDto {
  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsString()
  secret_key?: string;

  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_test_mode?: boolean;
}
