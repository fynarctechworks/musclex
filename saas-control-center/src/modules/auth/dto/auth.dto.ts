import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@musclex.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'YourStr0ngPassword!' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refresh_token!: string;
}

export class VerifyMfaLoginDto {
  @ApiProperty({ description: 'Temporary MFA session token returned after password validation' })
  @IsString()
  mfa_session_token!: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  totp_code!: string;
}

export class RecoveryLoginDto {
  @ApiProperty({ description: 'Temporary MFA session token returned after password validation' })
  @IsString()
  mfa_session_token!: string;

  @ApiProperty({ description: '8-character recovery code (XXXX-XXXX format)' })
  @IsString()
  recovery_code!: string;
}

export class SetupMfaDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator to confirm setup' })
  @IsString()
  totp_code!: string;
}

export class DisableMfaDto {
  @ApiProperty({ description: 'Current account password to confirm identity' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@musclex.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from password reset email' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'New password — minimum 12 characters' })
  @IsString()
  @MinLength(12)
  new_password!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password!: string;

  @ApiProperty({ description: 'Minimum 12 characters' })
  @IsString()
  @MinLength(12)
  new_password!: string;
}
