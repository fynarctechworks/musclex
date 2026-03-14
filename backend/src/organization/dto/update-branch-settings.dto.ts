import { IsString, IsOptional, IsObject, IsNumber, Min, Max } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateBranchSettingsDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax_percentage?: number;

  @IsOptional()
  @IsObject()
  membership_policy?: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  checkin_policy?: Prisma.InputJsonValue;

  @IsOptional()
  @IsObject()
  notification_prefs?: Prisma.InputJsonValue;
}
