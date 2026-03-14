import { IsString, IsOptional, IsNumber, IsUUID, IsIn } from 'class-validator';

export class CreateMemberReferralDto {
  @IsUUID()
  referrer_member_id: string;

  @IsUUID()
  referred_member_id: string;

  @IsString()
  @IsOptional()
  @IsIn(['discount', 'free_days', 'cash'])
  reward_type?: string;

  @IsNumber()
  @IsOptional()
  reward_value?: number;
}

export class UpdateReferralStatusDto {
  @IsString()
  @IsIn(['pending', 'awarded', 'expired'])
  reward_status: string;
}
