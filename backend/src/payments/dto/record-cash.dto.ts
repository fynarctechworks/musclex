import { IsString, IsNumber, IsOptional, IsUUID, IsPositive, IsIn } from 'class-validator';

export class RecordCashDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  @IsOptional()
  membership_id?: string;

  @IsUUID()
  branch_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsIn(['cash', 'card', 'upi', 'bank_transfer', 'razorpay'])
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsIn(['monthly', 'yearly'])
  @IsOptional()
  billing_cycle?: 'monthly' | 'yearly';

  @IsString()
  @IsOptional()
  notes?: string;
}
