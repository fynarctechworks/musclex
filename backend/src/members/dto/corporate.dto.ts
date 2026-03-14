import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  IsInt,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class CreateCorporateAccountDto {
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsString()
  company_name: string;

  @IsString()
  contact_person: string;

  @IsEmail()
  contact_email: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsString()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  @IsOptional()
  billing_cycle?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_percent?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  max_members?: number;
}

export class AddCorporateMemberDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  @IsOptional()
  membership_id?: string;

  @IsString()
  @IsOptional()
  employee_id?: string;
}
