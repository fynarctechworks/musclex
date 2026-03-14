import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsArray,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

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

  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive', 'on_leave', 'terminated'])
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specializations?: string[];

  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsNumber()
  @IsOptional()
  performance_score?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsDateString()
  @IsOptional()
  joined_at?: string;
}
