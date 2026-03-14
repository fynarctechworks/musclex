import { IsString, IsOptional, IsArray, IsNumber, IsInt, Min, Max } from 'class-validator';

export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  experience_years?: number;

  @IsOptional()
  @IsString()
  profile_photo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;
}
