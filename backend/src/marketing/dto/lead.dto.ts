import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsEmail,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  full_name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsIn(['website', 'instagram', 'facebook_ads', 'walk_in', 'referral', 'google_ads'])
  lead_source: string;

  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsUUID()
  @IsOptional()
  assigned_staff_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateLeadDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsIn(['new', 'contacted', 'trial_scheduled', 'converted', 'lost'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  assigned_staff_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  converted_member_id?: string;
}

export class CreateLeadActivityDto {
  @IsUUID()
  lead_id: string;

  @IsUUID()
  @IsOptional()
  staff_id?: string;

  @IsString()
  @IsIn(['call', 'email', 'visit', 'trial_booking', 'note', 'status_change'])
  activity_type: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
