import { IsString, IsOptional, IsEmail, IsDateString, IsUUID, IsIn } from 'class-validator';

export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

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

  @IsString()
  @IsOptional()
  @IsIn(['lead', 'trial', 'active', 'inactive', 'frozen', 'cancelled', 'expired'])
  status?: string;
}
