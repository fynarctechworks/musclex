import { IsString, IsOptional, IsObject } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  default_timezone?: string;

  @IsOptional()
  @IsString()
  default_currency?: string;

  @IsOptional()
  @IsString()
  billing_plan?: string;

  @IsOptional()
  @IsObject()
  feature_flags?: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  branding?: Prisma.InputJsonValue;
}
