import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateIntegrationDto {
  @IsString()
  provider: string; // twilio | whatsapp | razorpay | stripe | resend | google_calendar | zapier

  @IsString()
  display_name: string;

  @IsOptional()
  @IsObject()
  config?: Prisma.InputJsonValue; // api keys, tokens, etc.

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsObject()
  config?: Prisma.InputJsonValue;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonValue;
}

export class TestIntegrationDto {
  @IsOptional()
  @IsObject()
  test_payload?: Prisma.InputJsonValue;
}
