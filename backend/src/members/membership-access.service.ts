import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { TransferMemberDto } from './dto/transfer-member.dto';
import { GrantTemporaryAccessDto } from './dto/grant-temporary-access.dto';
import { AuditService } from '../audit/audit.service';

/**
 * Cross-branch access management (Phase 4 & 5).
 *
 * - transferMember: changes a member's home branch. Memberships stay bound
 *   to their original branch for revenue attribution; only Member.branch_id
 *   flips and a row lands in member_transfer_logs.
 *
 * - grantTemporaryAccess: opens one or more branches to a specific
 *   membership for a bounded window. Used for "elite member travels to
 *   another city" scenarios. The check-in resolver filters expired grants
 *   automatically at load time.
 *
 * - revokeTemporaryAccess: removes a grant before its natural expiry —
 *   refuses to delete the home-branch row (would lock the member out).
 */
@Injectable()
export class MembershipAccessService {
  private readonly logger = new Logger(MembershipAccessService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    // Audit is optional so unit tests can omit it; controller always provides.
    private readonly audit?: AuditService,
  ) {}

  /**
   * Fire-and-forget audit emission. Audit must never block or fail a
   * mutation; we log and move on if the audit row can't be written.
   */
  private safeAudit(params: {
    user_id: string | undefined;
    action: string;
    entity_id?: string;
    entity_type?: string;
    details?: Record<string, unknown>;
    ip_address?: string;
  }): void {
    if (!this.audit || !params.user_id) return;
    this.audit
      .log({
        user_id: params.user_id,
        action: params.action,
        module: 'members',
        entity_id: params.entity_id,
        entity_type: params.entity_type,
        details: params.details,
        ip_address: params.ip_address,
      })
      .catch((err) =>
        this.logger.warn(
          `Audit emission failed for ${params.action}: ${err.message}`,
        ),
      );
  }

  // ── Phase 4: branch transfer ──────────────────────────────────────────

  async transferMember(
    memberId: string,
    dto: TransferMemberDto,
    actorUserId?: string,
    actorIp?: string,
  ) {
    const member = await this.tenant.client.member.findUnique({
      where: { id: memberId },
      select: { id: true, branch_id: true, organization_id: true, full_name: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    if (member.branch_id === dto.to_branch_id) {
      throw new BadRequestException('Member is already at the target branch');
    }

    const toBranch = await this.tenant.client.branch.findUnique({
      where: { id: dto.to_branch_id },
      select: { id: true, organization_id: true, is_active: true },
    });
    if (!toBranch) throw new NotFoundException('Target branch not found');
    if (!toBranch.is_active) {
      throw new BadRequestException('Target branch is not active');
    }

    // Cross-organization transfers are not supported — would orphan the
    // member's payment history and break revenue attribution. Operators
    // should off-board / re-onboard instead.
    if (
      member.organization_id &&
      toBranch.organization_id &&
      member.organization_id !== toBranch.organization_id
    ) {
      throw new ForbiddenException(
        'Cannot transfer member between organizations',
      );
    }

    const fromBranchId = member.branch_id;
    const gymId = getTenantGymId()!;

    const result = await this.tenant.client.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: memberId },
        data: { branch_id: dto.to_branch_id },
        select: {
          id: true,
          full_name: true,
          branch_id: true,
          member_code: true,
        },
      });

      const log = await tx.memberTransferLog.create({
        data: {
          gym_id: gymId,
          member_id: memberId,
          from_branch_id: fromBranchId,
          to_branch_id: dto.to_branch_id,
          reason: dto.reason,
          transferred_by: actorUserId,
        },
      });

      // Existing memberships intentionally keep their branch_id so financial
      // history stays attached to the originating branch. The check-in
      // resolver respects MembershipBranchAccess, so to let the member use
      // the new branch on existing memberships we add explicit grants.
      const activeMemberships = await tx.memberMembership.findMany({
        where: { member_id: memberId, status: { in: ['active', 'frozen'] } },
        select: { id: true },
      });

      for (const m of activeMemberships) {
        await tx.membershipBranchAccess.upsert({
          where: {
            membership_id_branch_id: {
              membership_id: m.id,
              branch_id: dto.to_branch_id,
            },
          },
          update: {},
          create: {
            gym_id: gymId,
            membership_id: m.id,
            branch_id: dto.to_branch_id,
            granted_by: actorUserId ?? null,
            reason: 'home_branch_transfer',
          },
        });
      }

      return { member: updated, transfer_log_id: log.id, memberships_extended: activeMemberships.length };
    });

    this.logger.log(
      `Transferred member ${memberId} from ${fromBranchId} → ${dto.to_branch_id} (${result.memberships_extended} memberships extended)`,
    );

    this.safeAudit({
      user_id: actorUserId,
      action: 'member.transfer',
      entity_id: memberId,
      entity_type: 'member',
      details: {
        from_branch_id: fromBranchId,
        to_branch_id: dto.to_branch_id,
        memberships_extended: result.memberships_extended,
        reason: dto.reason ?? null,
        transfer_log_id: result.transfer_log_id,
      },
      ip_address: actorIp,
    });

    return result;
  }

  async listTransferHistory(memberId: string) {
    return this.tenant.client.memberTransferLog.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  // ── Phase 5: temporary access ─────────────────────────────────────────

  async grantTemporaryAccess(
    memberId: string,
    dto: GrantTemporaryAccessDto,
    actorUserId?: string,
    actorIp?: string,
  ) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: dto.membership_id },
      select: {
        id: true,
        member_id: true,
        status: true,
        branch_id: true,
        end_date: true,
      },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.member_id !== memberId) {
      throw new BadRequestException('Membership does not belong to this member');
    }
    if (membership.status !== 'active') {
      throw new BadRequestException(
        `Cannot grant access on a ${membership.status} membership`,
      );
    }

    const expiresAt = new Date(dto.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('expires_at must be a future date');
    }
    if (membership.end_date && expiresAt > membership.end_date) {
      throw new BadRequestException(
        'Temporary access cannot extend past membership end_date',
      );
    }

    // Validate every branch exists and is active before granting anything —
    // partial grants are confusing for the front desk.
    const branches = await this.tenant.client.branch.findMany({
      where: { id: { in: dto.branch_ids } },
      select: { id: true, is_active: true },
    });
    if (branches.length !== dto.branch_ids.length) {
      throw new BadRequestException('One or more branch_ids do not exist');
    }
    const inactive = branches.filter((b) => !b.is_active);
    if (inactive.length > 0) {
      throw new BadRequestException(
        `Branch(es) not active: ${inactive.map((b) => b.id).join(', ')}`,
      );
    }

    const gymId = getTenantGymId()!;

    const grants = await this.tenant.client.$transaction(async (tx) => {
      const out = [];
      for (const branchId of dto.branch_ids) {
        const row = await tx.membershipBranchAccess.upsert({
          where: {
            membership_id_branch_id: {
              membership_id: dto.membership_id,
              branch_id: branchId,
            },
          },
          // Re-issuing a grant for the same branch refreshes the expiry —
          // staff workflow is "extend their travel pass another 7 days".
          update: {
            expires_at: expiresAt,
            reason: dto.reason ?? 'temporary_access',
            granted_by: actorUserId ?? null,
            granted_at: new Date(),
          },
          create: {
            gym_id: gymId,
            membership_id: dto.membership_id,
            branch_id: branchId,
            expires_at: expiresAt,
            reason: dto.reason ?? 'temporary_access',
            granted_by: actorUserId ?? null,
          },
        });
        out.push(row);
      }
      return out;
    });

    this.logger.log(
      `Granted temporary access on membership ${dto.membership_id} to ${dto.branch_ids.length} branch(es) until ${expiresAt.toISOString()}`,
    );

    this.safeAudit({
      user_id: actorUserId,
      action: 'membership.access.grant',
      entity_id: dto.membership_id,
      entity_type: 'member_membership',
      details: {
        member_id: memberId,
        branch_ids: dto.branch_ids,
        expires_at: expiresAt.toISOString(),
        reason: dto.reason ?? null,
      },
      ip_address: actorIp,
    });

    return { grants, expires_at: expiresAt.toISOString() };
  }

  async revokeTemporaryAccess(
    membershipId: string,
    branchId: string,
    actorUserId?: string,
    actorIp?: string,
  ) {
    const membership = await this.tenant.client.memberMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, branch_id: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');

    // Refuse to revoke the home-branch row — that would lock the member
    // out of their own gym. Home-branch access is implicit, not revocable.
    if (membership.branch_id === branchId) {
      throw new BadRequestException(
        'Cannot revoke access to the membership home branch',
      );
    }

    const deleted = await this.tenant.client.membershipBranchAccess.deleteMany({
      where: { membership_id: membershipId, branch_id: branchId },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('No access grant found for that branch');
    }

    this.safeAudit({
      user_id: actorUserId,
      action: 'membership.access.revoke',
      entity_id: membershipId,
      entity_type: 'member_membership',
      details: { branch_id: branchId, count: deleted.count },
      ip_address: actorIp,
    });

    return { revoked: deleted.count };
  }

  async listAccessGrants(membershipId: string) {
    return this.tenant.client.membershipBranchAccess.findMany({
      where: { membership_id: membershipId },
      include: { branch: { select: { id: true, name: true, city: true } } },
      orderBy: { granted_at: 'desc' },
    });
  }
}
