import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class RecordCashPaymentDto {
  @IsUUID()
  member_id: string;

  @IsOptional()
  @IsUUID()
  membership_id?: string;

  @IsUUID()
  branch_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGatewayOrderDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;

  @IsOptional()
  @IsUUID()
  invoice_id?: string;

  @IsIn(['razorpay'])
  gateway: 'razorpay';
}

export class VerifyPaymentDto {
  @IsString()
  gateway_payment_id: string;

  @IsString()
  gateway_order_id: string;

  @IsString()
  signature: string;

  @IsUUID()
  member_id: string;

  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;
}

export class ProcessRefundDto {
  @IsUUID()
  payment_id: string;

  @IsNumber()
  @Min(0.01)
  refund_amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  processed_by?: string;
}
