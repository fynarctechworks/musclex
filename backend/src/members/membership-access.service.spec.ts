import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MembershipAccessService } from './membership-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { tenantContext } from '../common/tenant-context';

/**
 * Unit tests for MembershipAccessService — covers transferMember and the
 * temporary-access lifecycle (grant / list / revoke). Prisma is mocked;
 * tenant context is supplied via AsyncLocalStorage so getTenantGymId() in
 * the service resolves.
 */
describe('MembershipAccessService', () => {
  const GYM = '00000000-0000-0000-0000-0000000000aa';
  const ORG = '00000000-0000-0000-0000-0000000000ab';
  const OTHER_ORG = '00000000-0000-0000-0000-0000000000ac';
  const MEMBER = '00000000-0000-0000-0000-0000000000b1';
  const HOME = '00000000-0000-0000-0000-0000000000c1';
  const NEW_BRANCH = '00000000-0000-0000-0000-0000000000c2';
  const SISTER = '00000000-0000-0000-0000-0000000000c3';
  const MEMBERSHIP = '00000000-0000-0000-0000-0000000000d1';
  const ACTOR = '00000000-0000-0000-0000-0000000000e1';

  // Run a test body inside a tenant ALS scope.
  const inTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContext.run(
      {
        schemaName: `studio_${GYM.replace(/-/g, '_')}`,
        gymId: GYM,
        activeBranchId: HOME,
        allowedBranchIds: 'ALL',
        bypassBranchScope: false,
      },
      fn,
    );

  // Fresh mock prisma + service per test.
  function makeService() {
    const member = { findUnique: jest.fn(), update: jest.fn() };
    const branch = { findUnique: jest.fn(), findMany: jest.fn() };
    const memberMembership = { findUnique: jest.fn(), findMany: jest.fn() };
    const memberTransferLog = { create: jest.fn(), findMany: jest.fn() };
    const membershipBranchAccess = {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    };
    const prisma: any = {
      member,
      branch,
      memberMembership,
      memberTransferLog,
      membershipBranchAccess,
      $transaction: jest.fn(async (cb: any) =>
        cb({
          member,
          memberTransferLog,
          memberMembership,
          membershipBranchAccess,
        }),
      ),
    };
    return { prisma, service: new MembershipAccessService(prisma) };
  }

  // ── transferMember ────────────────────────────────────────────────────

  describe('transferMember', () => {
    it('flips home branch, writes audit log, and extends every active membership to the new branch', async () => {
      const { prisma, service } = makeService();

      prisma.member.findUnique.mockResolvedValue({
        id: MEMBER,
        branch_id: HOME,
        organization_id: ORG,
        full_name: 'Test',
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: NEW_BRANCH,
        organization_id: ORG,
        is_active: true,
      });
      prisma.member.update.mockResolvedValue({
        id: MEMBER,
        full_name: 'Test',
        branch_id: NEW_BRANCH,
        member_code: 'FS-1',
      });
      prisma.memberTransferLog.create.mockResolvedValue({ id: 'log-1' });
      prisma.memberMembership.findMany.mockResolvedValue([
        { id: 'm1' },
        { id: 'm2' },
      ]);
      prisma.membershipBranchAccess.upsert.mockResolvedValue({});

      const result = await inTenant(() =>
        service.transferMember(
          MEMBER,
          { to_branch_id: NEW_BRANCH, reason: 'moved' },
          ACTOR,
        ),
      );

      expect(result.memberships_extended).toBe(2);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: MEMBER },
        data: { branch_id: NEW_BRANCH },
        select: expect.any(Object),
      });
      expect(prisma.memberTransferLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          from_branch_id: HOME,
          to_branch_id: NEW_BRANCH,
          reason: 'moved',
          transferred_by: ACTOR,
        }),
      });
      expect(prisma.membershipBranchAccess.upsert).toHaveBeenCalledTimes(2);
    });

    it('throws NotFound when the member does not exist', async () => {
      const { prisma, service } = makeService();
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        inTenant(() =>
          service.transferMember(MEMBER, { to_branch_id: NEW_BRANCH }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when transferring to the same branch', async () => {
      const { prisma, service } = makeService();
      prisma.member.findUnique.mockResolvedValue({
        id: MEMBER,
        branch_id: HOME,
        organization_id: ORG,
      });

      await expect(
        inTenant(() =>
          service.transferMember(MEMBER, { to_branch_id: HOME }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when the destination branch is inactive', async () => {
      const { prisma, service } = makeService();
      prisma.member.findUnique.mockResolvedValue({
        id: MEMBER,
        branch_id: HOME,
        organization_id: ORG,
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: NEW_BRANCH,
        organization_id: ORG,
        is_active: false,
      });

      await expect(
        inTenant(() =>
          service.transferMember(MEMBER, { to_branch_id: NEW_BRANCH }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws Forbidden on cross-organization transfer', async () => {
      const { prisma, service } = makeService();
      prisma.member.findUnique.mockResolvedValue({
        id: MEMBER,
        branch_id: HOME,
        organization_id: ORG,
      });
      prisma.branch.findUnique.mockResolvedValue({
        id: NEW_BRANCH,
        organization_id: OTHER_ORG,
        is_active: true,
      });

      await expect(
        inTenant(() =>
          service.transferMember(MEMBER, { to_branch_id: NEW_BRANCH }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── grantTemporaryAccess ──────────────────────────────────────────────

  describe('grantTemporaryAccess', () => {
    const future = () =>
      new Date(Date.now() + 7 * 86400000).toISOString();

    it('upserts a row per branch with the given expires_at and reason', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'active',
        branch_id: HOME,
        end_date: new Date(Date.now() + 90 * 86400000),
      });
      prisma.branch.findMany.mockResolvedValue([
        { id: NEW_BRANCH, is_active: true },
        { id: SISTER, is_active: true },
      ]);
      prisma.membershipBranchAccess.upsert.mockResolvedValue({});

      const result = await inTenant(() =>
        service.grantTemporaryAccess(
          MEMBER,
          {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH, SISTER],
            expires_at: future(),
            reason: 'travel pass',
          },
          ACTOR,
        ),
      );

      expect(prisma.membershipBranchAccess.upsert).toHaveBeenCalledTimes(2);
      expect(result.grants).toHaveLength(2);
    });

    it('rejects expires_at in the past', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'active',
        branch_id: HOME,
        end_date: null,
      });

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH],
            expires_at: new Date(Date.now() - 86400000).toISOString(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects expires_at past membership end_date', async () => {
      const { prisma, service } = makeService();
      const memberEnd = new Date(Date.now() + 5 * 86400000);
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'active',
        branch_id: HOME,
        end_date: memberEnd,
      });

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH],
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects grant on a frozen or cancelled membership', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'frozen',
        branch_id: HOME,
        end_date: null,
      });

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH],
            expires_at: future(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects grant when membership belongs to a different member', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: 'someone-else',
        status: 'active',
        branch_id: HOME,
        end_date: null,
      });

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH],
            expires_at: future(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when one branch does not exist', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'active',
        branch_id: HOME,
        end_date: null,
      });
      // Asked for 2, db only returns 1
      prisma.branch.findMany.mockResolvedValue([
        { id: NEW_BRANCH, is_active: true },
      ]);

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH, SISTER],
            expires_at: future(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when any target branch is inactive', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        member_id: MEMBER,
        status: 'active',
        branch_id: HOME,
        end_date: null,
      });
      prisma.branch.findMany.mockResolvedValue([
        { id: NEW_BRANCH, is_active: true },
        { id: SISTER, is_active: false },
      ]);

      await expect(
        inTenant(() =>
          service.grantTemporaryAccess(MEMBER, {
            membership_id: MEMBERSHIP,
            branch_ids: [NEW_BRANCH, SISTER],
            expires_at: future(),
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── revokeTemporaryAccess ─────────────────────────────────────────────

  describe('revokeTemporaryAccess', () => {
    it('refuses to revoke the home-branch grant', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        branch_id: HOME,
      });

      await expect(
        inTenant(() => service.revokeTemporaryAccess(MEMBERSHIP, HOME)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when no grant exists for that branch', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        branch_id: HOME,
      });
      prisma.membershipBranchAccess.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        inTenant(() => service.revokeTemporaryAccess(MEMBERSHIP, NEW_BRANCH)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a non-home grant and returns the count', async () => {
      const { prisma, service } = makeService();
      prisma.memberMembership.findUnique.mockResolvedValue({
        id: MEMBERSHIP,
        branch_id: HOME,
      });
      prisma.membershipBranchAccess.deleteMany.mockResolvedValue({ count: 1 });

      const result = await inTenant(() =>
        service.revokeTemporaryAccess(MEMBERSHIP, NEW_BRANCH),
      );

      expect(result).toEqual({ revoked: 1 });
      expect(prisma.membershipBranchAccess.deleteMany).toHaveBeenCalledWith({
        where: { membership_id: MEMBERSHIP, branch_id: NEW_BRANCH },
      });
    });
  });

  // ── listTransferHistory / listAccessGrants (smoke) ────────────────────

  describe('list endpoints', () => {
    it('listTransferHistory delegates to prisma with sane defaults', async () => {
      const { prisma, service } = makeService();
      prisma.memberTransferLog.findMany.mockResolvedValue([]);

      await inTenant(() => service.listTransferHistory(MEMBER));

      expect(prisma.memberTransferLog.findMany).toHaveBeenCalledWith({
        where: { member_id: MEMBER },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    it('listAccessGrants includes the branch relation', async () => {
      const { prisma, service } = makeService();
      prisma.membershipBranchAccess.findMany.mockResolvedValue([]);

      await inTenant(() => service.listAccessGrants(MEMBERSHIP));

      expect(prisma.membershipBranchAccess.findMany).toHaveBeenCalledWith({
        where: { membership_id: MEMBERSHIP },
        include: { branch: expect.any(Object) },
        orderBy: { granted_at: 'desc' },
      });
    });
  });
});
