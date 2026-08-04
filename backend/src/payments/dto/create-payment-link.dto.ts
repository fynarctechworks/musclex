import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentLinkDto {
  @IsUUID()
  member_id: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  /** Charge a plan's price. */
  @IsOptional()
  @IsUUID()
  plan_id?: string;

  /** Charge an explicit amount (e.g. an invoice balance or part payment). */
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  /** Reconcile against this invoice when the payment completes. */
  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  /** Deliver the link immediately over these channels. */
  @IsOptional()
  @IsArray()
  @IsIn(['whatsapp', 'email'], { each: true })
  send_via?: Array<'whatsapp' | 'email'>;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
