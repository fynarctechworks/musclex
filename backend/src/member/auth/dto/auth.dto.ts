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
