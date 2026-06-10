import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import type {
  OtpRequestBody,
  SessionRequestBody,
  RefreshRequestBody,
} from '../../contract';

/**
 * Request DTOs for the member auth endpoints. Each `implements` its generated
 * contract request-body type, so a contract change forces the DTO to update
 * (or fails compilation) — runtime validation (class-validator) + contract-sync.
 */

export class OtpRequestDto implements OtpRequestBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone!: string;
}

export class SessionDto implements SessionRequestBody {
  @IsString()
  @IsNotEmpty()
  supabaseToken!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class RefreshDto implements RefreshRequestBody {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

/**
 * ⚠️ DEV-ONLY. Body for the OTP-bypass login. The route 404s unless the server
 * has the bypass enabled (non-production + MEMBER_DEV_OTP set), so this DTO is
 * inert in production regardless of input.
 */
export class DevSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
