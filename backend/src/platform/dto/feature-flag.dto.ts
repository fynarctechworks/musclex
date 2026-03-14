import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateFeatureFlagDto {
  @IsString()
  key: string; // e.g. "facial_recognition", "ai_advisor", "pos_module"

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue; // conditions, rollout %, etc.
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}

export class BulkToggleFlagsDto {
  @IsObject()
  flags: Record<string, boolean>; // { "facial_recognition": true, "pos_module": false }
}
