import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { TwoFactorService } from './two-factor.service';
import {
  Verify2faSetupDto,
  Login2faDto,
  Disable2faDto,
  Recover2faDto,
  Reset2faDto,
} from './dto';
import { JwtAuthGuard, CurrentUser, JwtPayload, RolesGuard, Roles } from '../common';

@Controller('api/v1/auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  /** Begin 2FA setup — returns QR code & manual key */
  @Post('setup')
  @UseGuards(JwtAuthGuard)
  setup(@CurrentUser() user: JwtPayload) {
    return this.twoFactorService.setup(user.user_id);
  }

  /** Confirm setup with a code from the authenticator app */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verify(@CurrentUser() user: JwtPayload, @Body() dto: Verify2faSetupDto) {
    return this.twoFactorService.verifySetup(user.user_id, dto.code);
  }

  /** Step-2 of login — verify TOTP / backup code */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: Login2faDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    return this.twoFactorService.verifyLogin(dto.tempToken, dto.code, {
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  /** Disable 2FA (requires password confirmation) */
  @Post('disable')
  @UseGuards(JwtAuthGuard)
  disable(@CurrentUser() user: JwtPayload, @Body() dto: Disable2faDto) {
    return this.twoFactorService.disable(user.user_id, dto.password);
  }

  /** Get current 2FA status */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: JwtPayload) {
    return this.twoFactorService.getStatus(user.user_id);
  }

  /** Admin: reset 2FA for a specific user */
  @Post('admin-reset/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  adminReset(
    @CurrentUser() admin: JwtPayload,
    @Param('userId') userId: string,
  ) {
    return this.twoFactorService.adminReset2fa(userId, admin.user_id);
  }
}

/**
 * Public 2FA recovery endpoints (no JWT — user is locked out).
 * Mounted at /api/v1/auth/ to match the frontend API stubs.
 */
@Controller('api/v1/auth')
export class TwoFactorRecoveryController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  /** Request a recovery email for lost authenticator */
  @Post('recover-2fa')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  recover(@Body() dto: Recover2faDto) {
    return this.twoFactorService.requestRecovery(dto.email);
  }

  /** Complete 2FA reset via recovery token + password */
  @Post('reset-2fa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  reset(@Body() dto: Reset2faDto) {
    return this.twoFactorService.resetWithRecovery(dto.token, dto.password);
  }
}

