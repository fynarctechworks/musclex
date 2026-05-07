import { IsString, IsNumber, IsOptional, Length, Min } from 'class-validator';

export class OnboardingPaymentDto {
  @IsString()
  plan_id!: string;

  @IsString()
  @Length(4, 4)
  card_last4!: string;

  @IsString()
  card_brand!: string;

  @IsString()
  billing_name!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
