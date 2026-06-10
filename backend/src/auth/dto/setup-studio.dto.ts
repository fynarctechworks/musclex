import { IsEmail, IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SetupStudioDto {
  @IsString()
  studio_name: string;

  @IsString()
  @IsOptional()
  business_type?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  logo_url?: string;

  @IsString()
  @IsOptional()
  website?: string;
}

export class OnboardingBranchDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  postal_code?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class OnboardingBranchesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingBranchDto)
  branches: OnboardingBranchDto[];
}

export class OnboardingMembershipDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  plan_type: string;

  @IsNumber()
  @IsOptional()
  duration_days?: number;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  is_template?: boolean;
}

export class OnboardingMembershipsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingMembershipDto)
  plans: OnboardingMembershipDto[];
}

export class OnboardingStaffDto {
  @IsString()
  full_name: string;

  @IsString()
  role: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class OnboardingStaffListDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingStaffDto)
  staff: OnboardingStaffDto[];
}

export class OnboardingSkipStepDto {
  @IsString()
  current_step: string;
}
