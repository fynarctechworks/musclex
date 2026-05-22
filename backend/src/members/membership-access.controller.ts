import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MembershipAccessService } from './membership-access.service';
import {
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
} from '../common';
import { GrantTemporaryAccessDto, TransferMemberDto } from './dto';

@Controller('api/v1/members')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class MembershipAccessController {
  constructor(private readonly access: MembershipAccessService) {}

  // ── Phase 4: branch transfer ──────────────────────────────────────────
  // Privileged: only owner/brand_owner/branch_manager. Rate-limited to
  // 10/min/user to slow a compromised manager session from rapidly
  // re-assigning every member.

  @Post(':id/transfer')
  @Roles('owner', 'brand_owner', 'branch_manager')
  @Permissions({ module: 'members', action: 'edit' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  transfer(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
    @Body() dto: TransferMemberDto,
    @Ip() ip: string,
  ) {
    return this.access.transferMember(memberId, dto, user.user_id, ip);
  }

  @Get(':id/transfers')
  @Permissions({ module: 'members', action: 'view' })
  history(@Param('id') memberId: string) {
    return this.access.listTransferHistory(memberId);
  }

  // ── Phase 5: temporary cross-branch access ────────────────────────────
  // Same privilege class as transfer; tighter rate limit (20/min) because
  // bulk grant + revoke could be used to silently issue passes at scale.

  @Post(':id/temporary-access')
  @Roles('owner', 'brand_owner', 'branch_manager')
  @Permissions({ module: 'members', action: 'edit' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  grantTemporary(
    @CurrentUser() user: JwtPayload,
    @Param('id') memberId: string,
    @Body() dto: GrantTemporaryAccessDto,
    @Ip() ip: string,
  ) {
    return this.access.grantTemporaryAccess(memberId, dto, user.user_id, ip);
  }

  @Get('memberships/:membershipId/access')
  @Permissions({ module: 'members', action: 'view' })
  listAccess(@Param('membershipId') membershipId: string) {
    return this.access.listAccessGrants(membershipId);
  }

  @Delete('memberships/:membershipId/access/:branchId')
  @Roles('owner', 'brand_owner', 'branch_manager')
  @Permissions({ module: 'members', action: 'edit' })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  revoke(
    @CurrentUser() user: JwtPayload,
    @Param('membershipId') membershipId: string,
    @Param('branchId') branchId: string,
    @Ip() ip: string,
  ) {
    return this.access.revokeTemporaryAccess(
      membershipId,
      branchId,
      user.user_id,
      ip,
    );
  }
}
