import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateMemberDto {
  @IsString()
  full_name: string;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsUUID()
  branch_id: string;

  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsString()
  @IsOptional()
  @IsIn(['male', 'female', 'other', 'prefer_not_to_say'])
  gender?: string;

  @IsDateString()
  @IsOptional()
  date_of_birth?: string;

  @IsDateString()
  @IsOptional()
  join_date?: string;

  @IsString()
  @IsOptional()
  emergency_contact_name?: string;

  @IsString()
  @IsOptional()
  emergency_contact_phone?: string;

  @IsString()
  @IsOptional()
  profile_photo_url?: string;

  @IsString()
  @IsOptional()
  checkin_method?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  plan_id?: string;

  @IsDateString()
  @IsOptional()
  membership_start_date?: string;

  @IsUUID()
  @IsOptional()
  referred_by_member_id?: string;

  @IsString()
  @IsOptional()
  @IsIn(['lead', 'trial', 'active', 'inactive'])
  status?: string;
}
