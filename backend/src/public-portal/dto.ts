import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name: string;

  @IsString()
  @Matches(/^[+\d][\d\s-]{7,17}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** 'enquiry' → status new; 'trial' → status trial_scheduled + trial_booking activity. */
  @IsOptional()
  @IsIn(['enquiry', 'trial'])
  intent?: string;

  @IsOptional()
  @IsDateString()
  preferred_date?: string;
}

export class PublicCheckoutDto {
  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name: string;

  @IsString()
  @Matches(/^[+\d][\d\s-]{7,17}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PublicCheckoutVerifyDto {
  @IsString()
  @MaxLength(120)
  gateway_order_id: string;

  @IsString()
  @MaxLength(120)
  gateway_payment_id: string;

  @IsString()
  @MaxLength(256)
  signature: string;
}
