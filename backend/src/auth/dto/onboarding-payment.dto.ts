import { IsString, IsNumber, IsOptional, IsEmail, Length, Min, Matches } from 'class-validator';

export class OnboardingPaymentDto {
  @IsString()
  plan_id!: string;

  // ── Razorpay Checkout handshake (preferred path). When present the backend
  // verifies the signature + re-fetches the order before recording. ──
  @IsOptional()
  @IsString()
  gateway_order_id?: string;

  @IsOptional()
  @IsString()
  gateway_payment_id?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  // Card metadata is now optional (the real gateway path doesn't expose it).
  @IsOptional()
  @IsString()
  @Length(4, 4)
  card_last4?: string;

  @IsOptional()
  @IsString()
  card_brand?: string;

  @IsString()
  billing_name!: string;

  // ── Billing information (mandatory — feeds the GST tax invoice) ──
  @IsEmail()
  billing_email!: string;

  @IsString()
  @Length(1, 500)
  billing_address!: string;

  // GSTIN is optional; when present it must be a valid 15-char GSTIN.
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  gstin?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
