import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  gateway_payment_id: string;

  @IsString()
  gateway_order_id: string;

  @IsString()
  signature: string;

  // Accepted for backward-compat but IGNORED by PaymentsService.verifyPayment —
  // member/branch are derived from the pending Payment row and plan from the
  // gateway order notes, so a client cannot swap the plan or the beneficiary.
  @IsOptional()
  @IsUUID()
  member_id?: string;

  @IsOptional()
  @IsUUID()
  plan_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
