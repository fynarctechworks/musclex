import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class OnboardingDto {
  @IsString()
  studio_name: string;

  @IsString()
  branch_name: string;

  @IsString()
  @IsOptional()
  branch_address?: string;

  @IsString()
  @IsOptional()
  branch_city?: string;

  @IsString()
  @IsOptional()
  branch_phone?: string;

  @IsString()
  full_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}
