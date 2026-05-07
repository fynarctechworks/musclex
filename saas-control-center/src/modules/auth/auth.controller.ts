import { Controller, Post, Get, Patch, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  VerifyMfaLoginDto,
  RecoveryLoginDto,
  SetupMfaDto,
  DisableMfaDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';

// Helper to extract admin id from request user set by JwtStrategy
function adminId(req: Request): string {
  return (req as any).user?.id;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Public: Login ────────────────────────────────────────────────────────
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login (step 1 — credentials)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.email, dto.password, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  // ── Public: MFA step 2 — TOTP verify ─────────────────────────────────────
  @Public()
  @Post('mfa/verify-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login with TOTP code (step 2 when MFA is enabled)' })
  verifyMfaLogin(@Body() dto: VerifyMfaLoginDto, @Req() req: Request) {
    return this.authService.verifyMfaLogin(dto.mfa_session_token, dto.totp_code, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  // ── Public: MFA step 2 — recovery code (lost phone) ──────────────────────
  @Public()
  @Post('mfa/recovery-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete login using a recovery code (when phone is lost)' })
  recoveryLogin(@Body() dto: RecoveryLoginDto, @Req() req: Request) {
    return this.authService.verifyRecoveryCode(dto.mfa_session_token, dto.recovery_code, {
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  // ── Public: Token refresh ─────────────────────────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  // ── Public: Forgot password ───────────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ── Public: Reset password ────────────────────────────────────────────────
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.new_password);
  }

  // ── Authenticated: Profile ────────────────────────────────────────────────
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current admin profile' })
  getProfile(@Req() req: Request) {
    return this.authService.getProfile(adminId(req));
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update display name' })
  updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(adminId(req), dto.name!);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password)' })
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(adminId(req), dto.current_password, dto.new_password);
  }

  // ── Authenticated: MFA Setup ──────────────────────────────────────────────
  @Post('mfa/setup/init')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start MFA setup — returns QR code and secret' })
  initMfaSetup(@Req() req: Request) {
    return this.authService.initMfaSetup(adminId(req));
  }

  @Post('mfa/setup/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm MFA setup with first TOTP code — returns backup recovery codes' })
  confirmMfaSetup(@Req() req: Request, @Body() dto: SetupMfaDto) {
    return this.authService.confirmMfaSetup(adminId(req), dto.totp_code);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA (requires password confirmation)' })
  disableMfa(@Req() req: Request, @Body() dto: DisableMfaDto) {
    return this.authService.disableMfa(adminId(req), dto.password);
  }
}
