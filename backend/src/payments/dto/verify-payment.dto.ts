import { IsString, IsUUID } from 'class-validator';

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
