import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsArray,
  IsNumber,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateStaffDto {
  @IsString()
  full_name: string;

  @IsString()
  role: string;

  @IsString()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsUUID()
  @IsOptional()
  user_id?: string;

  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  branch_ids?: string[];

  @IsString()
  @IsOptional()
  employee_code?: string;

  @IsString()
  @IsOptional()
  job_title?: string;

  @IsString()
  @IsOptional()
  @IsIn(['full_time', 'part_time', 'contract', 'freelance'])
  employment_type?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specializations?: string[];

  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsDateString()
  @IsOptional()
  joined_at?: string;
}
