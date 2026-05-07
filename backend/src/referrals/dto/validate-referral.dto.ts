import { IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ValidateReferralCodeDto {
  @IsString()
  @Length(6, 6, { message: 'Referral code must be exactly 6 characters' })
  @Matches(/^[A-Z0-9]+$/, { message: 'Referral code must be uppercase alphanumeric' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  code: string;
}
