import { IsIn, IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

/**
 * Used by payment webhooks / billing service to trigger reward evaluation.
 * Can also be called directly by the platform billing endpoint.
 */
export class ProcessSubscriptionEventDto {
  @IsString()
  studio_id: string;

  @IsString()
  plan_id: string;

  @IsIn(['monthly', 'annual'])
  billing_cycle: 'monthly' | 'annual';

  @IsNumber()
  @Min(0)
  amount_paid: number;

  @IsString()
  currency: string;

  /** Unique ID that anchors idempotency — use invoice_id or payment_id */
  @IsString()
  idempotency_key: string;

  @IsDateString()
  @IsOptional()
  activated_at?: string;
}
