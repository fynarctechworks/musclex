import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { QrTokenService } from './qr-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AllowWhenLocked,
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Permissions,
  PermissionsGuard,
} from '../../common';

/**
 * QR token management for the check-in module.
 *
 * - GET    /api/v1/check-ins/qr/members/:id           → current signed static token
 * - POST   /api/v1/check-ins/qr/members/:id/regenerate → bump qr_version, return new static token
 * - GET    /api/v1/check-ins/qr/members/:id/dynamic   → 30s rolling dynamic token (single use)
 *
 * All routes are permission-gated. Member-self endpoints are intentionally
 * omitted in this slice — they will land when the member mobile app
 * acquires its own auth context. Staff fetch tokens on behalf of members.
 *
 * @AllowWhenLocked() — QR management is operational infrastructure, must
 * keep working during SaaS billing grace just like the check-ins themselves.
 */
@Controller('api/v1/check-ins/qr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@AllowWhenLocked()
export class QrController {
  constructor(
    private readonly qrTokens: QrTokenService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('members/:id')
  @Permissions({ module: 'members', action: 'view' })
  async getStatic(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) memberId: string,
  ) {
    // Scope by gym_id: a caller authenticated for one gym must not be able to
    // read another gym's member (or mint a QR token for them) by passing a raw
    // member UUID. findUnique-by-id can't be gym-scoped by the tenant middleware
    // (R3 fails-open), so we filter explicitly on the caller's studio_id.
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gym_id: user.studio_id },
      select: { id: true, qr_version: true, full_name: true, member_code: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const token = this.qrTokens.signStatic({
      member_id: member.id,
      studio_id: user.studio_id,
      qr_version: member.qr_version,
    });

    return {
      member_id: member.id,
      member_code: member.member_code,
      qr_version: member.qr_version,
      token,
      kind: 'static' as const,
    };
  }

  @Post('members/:id/regenerate')
  @Permissions({ module: 'members', action: 'edit' })
  async regenerate(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) memberId: string,
  ) {
    // Verify the member belongs to the caller's gym BEFORE the write. Without
    // this, a staff member at one gym could bump another gym's member
    // qr_version and invalidate that gym's QR cards (cross-tenant tampering/DoS),
    // because update-by-id can't be gym-scoped by the tenant middleware (R3).
    const owned = await this.prisma.member.findFirst({
      where: { id: memberId, gym_id: user.studio_id },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Member not found');

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: {
        qr_version: { increment: 1 },
        qr_regenerated_at: new Date(),
      },
      select: { id: true, qr_version: true, member_code: true, qr_regenerated_at: true },
    });

    const token = this.qrTokens.signStatic({
      member_id: updated.id,
      studio_id: user.studio_id,
      qr_version: updated.qr_version,
    });

    return {
      member_id: updated.id,
      member_code: updated.member_code,
      qr_version: updated.qr_version,
      qr_regenerated_at: updated.qr_regenerated_at,
      token,
      kind: 'static' as const,
      message:
        'All previously-issued signed QR tokens for this member are now invalid. ' +
        'Distribute the new token via the member profile or mobile app.',
    };
  }

  @Get('members/:id/dynamic')
  @Permissions({ module: 'members', action: 'view' })
  async getDynamic(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) memberId: string,
  ) {
    // Gym-scoped (see getStatic) — no cross-tenant member read / token mint.
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gym_id: user.studio_id },
      select: { id: true, member_code: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const { token, jti, iat, exp } = this.qrTokens.signDynamic({
      member_id: member.id,
      studio_id: user.studio_id,
    });

    return {
      member_id: member.id,
      member_code: member.member_code,
      token,
      jti,
      iat,
      exp,
      kind: 'dynamic' as const,
      ttl_sec: exp - iat,
    };
  }
}
