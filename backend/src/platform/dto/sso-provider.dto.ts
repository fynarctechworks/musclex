import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsUrl,
} from 'class-validator';
import { Prisma } from '@prisma/client';

export class CreateSsoProviderDto {
  @IsString()
  provider_type: string; // google | microsoft | saml | oidc

  @IsString()
  display_name: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  encrypted_client_secret?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  issuer_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  authorization_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  token_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  userinfo_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsObject()
  attribute_mapping?: Prisma.InputJsonValue;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_provision_users?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_domains?: string[];
}

export class UpdateSsoProviderDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  encrypted_client_secret?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  issuer_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  authorization_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  token_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  userinfo_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsObject()
  attribute_mapping?: Prisma.InputJsonValue;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_provision_users?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_domains?: string[];
}
