import { IsString, IsUUID, IsIn } from 'class-validator';

export class RenewMemberDto {
  @IsUUID()
  plan_id: string;

  @IsString()
  @IsIn(['cash', 'card', 'upi', 'bank_transfer', 'razorpay', 'stripe'])
  payment_method: string;
}
