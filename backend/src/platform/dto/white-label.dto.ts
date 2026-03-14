import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsEmail,
  Matches,
} from 'class-validator';

export class UpdateWhiteLabelDto {
  @IsOptional()
  @IsString()
  custom_domain?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logo_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  favicon_url?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primary_color?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  secondary_color?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accent_color?: string;

  @IsOptional()
  @IsString()
  font_family?: string;

  @IsOptional()
  @IsString()
  email_from_name?: string;

  @IsOptional()
  @IsEmail()
  email_from_address?: string;

  @IsOptional()
  @IsEmail()
  support_email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  support_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  terms_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  privacy_url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
