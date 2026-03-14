import { IsString, IsUUID, IsIn } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;

  @IsIn(['razorpay', 'stripe'])
  gateway: 'razorpay' | 'stripe';
}
