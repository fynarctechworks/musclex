import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

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
  client_secret?: string;

  @IsOptional()
  @IsString()
  issuer_url?: string;

  @IsOptional()
  @IsString()
  authorization_url?: string;

  @IsOptional()
  @IsString()
  token_url?: string;

  @IsOptional()
  @IsString()
  userinfo_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  attribute_mapping?: Record<string, string>;

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
  client_secret?: string;

  @IsOptional()
  @IsString()
  issuer_url?: string;

  @IsOptional()
  @IsString()
  authorization_url?: string;

  @IsOptional()
  @IsString()
  token_url?: string;

  @IsOptional()
  @IsString()
  userinfo_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  attribute_mapping?: Record<string, string>;

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
