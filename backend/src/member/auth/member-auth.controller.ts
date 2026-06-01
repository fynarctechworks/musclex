import { Body, Controller, HttpCode, Post, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MemberAuthService } from './member-auth.service';
import { OtpRequestDto, SessionDto, RefreshDto } from './dto/auth.dto';
import { MemberExceptionFilter } from '../filters/member-exception.filter';
import { PublicMemberRoute } from '../decorators/public-member-route.decorator';

/**
 * Member auth endpoints (Checklist §1). All public (no member token yet) and
 * unenveloped by contract. Tenant comes from the resolved directory, never the
 * client. The global throttler applies; OTP requests are throttled tighter.
 */
@Controller('member/v1/auth')
@UseFilters(MemberExceptionFilter)
export class MemberAuthController {
  constructor(private readonly auth: MemberAuthService) {}

  @Post('otp/request')
  @PublicMemberRoute()
  @HttpCode(200)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('session')
  @PublicMemberRoute()
  @HttpCode(200)
  session(@Body() dto: SessionDto) {
    return this.auth.createSession(dto.supabaseToken, dto.tenantId);
  }

  @Post('refresh')
  @PublicMemberRoute()
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
