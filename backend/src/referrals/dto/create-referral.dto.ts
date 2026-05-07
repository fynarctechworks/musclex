import { IsEmail, IsString, IsOptional, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReferralDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]+$/)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  referral_code: string;

  @IsEmail()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  referred_email?: string;
}
