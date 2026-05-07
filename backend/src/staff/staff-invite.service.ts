import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../auth/rbac.service';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { getTenantGymId, tenantContext } from '../common/tenant-context';
import { ENTERPRISE_ROLES } from '../auth/rbac-seed.service';

@Injectable()
export class StaffInviteService {
  private readonly logger = new Logger(StaffInviteService.name);
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService,
    private identityService: AuthIdentityService,
    private configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  /**
   * Create and send an invite for a staff member.
   * Called after staff record is created (or can be re-sent).
   */
  async createInvite(params: {
    staff_id: string;
    studio_id: string;
    email: string;
    role_name: string;
    branch_id?: string;
    permission_overrides?: { grants?: string[]; denials?: string[] };
    invited_by: string;
  }) {
    // Validate the role exists
    if (!ENTERPRISE_ROLES[params.role_name]) {
      throw new BadRequestException(`Unknown role: ${params.role_name}`);
    }

    // Check if there's already a pending invite for this staff
    const existing = await this.prisma.staffInvitation.findFirst({
      where: {
        staff_id: params.staff_id,
        studio_id: params.studio_id,
        status: 'pending',
      },
    });
    if (existing) {
      // Revoke old invite and create a new one
      await this.prisma.staffInvitation.update({
        where: { id: existing.id },
        data: { status: 'revoked' },
      });
    }

    // Check if this email is already an active user in this studio
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: { email: params.email },
    });
    if (existingIdentity) {
      const existingRole = await this.prisma.userRole.findFirst({
        where: {
          user_id: existingIdentity.id,
          studio_id: params.studio_id,
        },
      });
      if (existingRole) {
        throw new ConflictException('This email already has access to this studio');
      }
    }

    // Generate secure invite token (48 bytes = 64 chars base64url)
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const invite = await this.prisma.staffInvitation.create({
      data: {
        studio_id: params.studio_id,
        staff_id: params.staff_id,
        email: params.email,
        token,
        role_name: params.role_name,
        branch_id: params.branch_id,
        permission_overrides: params.permission_overrides || {},
        status: 'pending',
        invited_by: params.invited_by,
        expires_at: expiresAt,
      },
    });

    // Get studio name for the email
    const studio = await this.prisma.studio.findUnique({
      where: { id: params.studio_id },
      select: { name: true },
    });

    // Send invite email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const inviteLink = `${frontendUrl}/invite/${token}`;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await this.sendInviteEmail(params.email, {
        studio_name: studio?.name || 'Your Gym',
        role_name: params.role_name,
        invite_link: inviteLink,
      });
      emailSent = true;
    } catch (err) {
      emailError = err?.message || 'Unknown error';
      this.logger.error(`Invite email failed for ${params.email}: ${emailError}`);
    }

    return {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role_name: invite.role_name,
      expires_at: invite.expires_at,
      invite_link: inviteLink,
      email_sent: emailSent,
      email_error: emailError,
    };
  }

  /**
   * Accept an invite — creates Supabase user, links staff record, assigns RBAC.
   * This is the main flow when staff clicks the invite link and sets their password.
   */
  async acceptInvite(params: {
    token: string;
    password: string;
    full_name?: string;
  }) {
    // 1. Validate invite
    const invite = await this.prisma.staffInvitation.findUnique({
      where: { token: params.token },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite link');
    }
    if (invite.status !== 'pending') {
      throw new BadRequestException(`This invite has already been ${invite.status}`);
    }
    if (invite.expires_at < new Date()) {
      await this.prisma.staffInvitation.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('This invite has expired. Ask your admin to resend it.');
    }

    // 2. Look up the studio for schema context
    const studio = await this.prisma.studio.findUnique({
      where: { id: invite.studio_id },
      select: { id: true, name: true, schema_name: true },
    });
    if (!studio) {
      throw new NotFoundException('Studio not found');
    }

    // 3. Create or find Supabase Auth user
    let userId: string;

    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: { email: invite.email },
    });

    if (existingIdentity) {
      // User already exists (multi-studio scenario)
      userId = existingIdentity.id;

      // Update Supabase metadata to include this studio
      await this.supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          studio_id: invite.studio_id,
          role: invite.role_name,
          onboarding_step: 'complete',
        },
      });
    } else {
      // Create new Supabase user
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: invite.email,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          full_name: params.full_name || invite.email.split('@')[0],
          role: invite.role_name,
          studio_id: invite.studio_id,
          branch_ids: invite.branch_id ? [invite.branch_id] : [],
          account_type: 'staff',
          onboarding_step: 'complete',
        },
      });

      if (authError || !authData.user) {
        this.logger.error(`Supabase user creation failed: ${authError?.message}`);
        throw new BadRequestException('Failed to create account. Please try again.');
      }

      userId = authData.user.id;

      // Sync to UserIdentity
      await this.identityService.syncIdentity({
        id: userId,
        email: invite.email,
        full_name: params.full_name || invite.email.split('@')[0],
        email_verified: true,
      });
    }

    // 4. Assign RBAC role (public schema)
    await this.rbacService.assignRole({
      user_id: userId,
      studio_id: invite.studio_id,
      role_name: invite.role_name,
      branch_id: invite.branch_id || undefined,
      is_primary: true,
      assigned_by: invite.invited_by,
    });

    // 5. Link staff record to user_id + apply permission overrides inside the tenant context.
    // acceptInvite is a public endpoint (no TenantMiddleware), so we manually enter the
    // AsyncLocalStorage store. This lets the PrismaService $use middleware issue
    // SET search_path + SET app.gym_id on the same connection Prisma uses for the model op,
    // which the prior raw-SQL approach couldn't guarantee across pooled connections.
    await this.runInTenantScope(studio.schema_name, invite.studio_id, async () => {
      const linked = await this.prisma.staff.updateMany({
        where: { id: invite.staff_id },
        data: { user_id: userId, updated_at: new Date() },
      });
      if (linked.count !== 1) {
        this.logger.error(
          `acceptInvite: staff link UPDATE affected ${linked.count} rows (expected 1) for staff_id=${invite.staff_id}, schema=${studio.schema_name}`,
        );
        throw new BadRequestException('Failed to link account to staff record');
      }
      this.logger.log(
        `acceptInvite: linked user_id=${userId} to staff_id=${invite.staff_id} in schema=${studio.schema_name}`,
      );

      const overrides = invite.permission_overrides as { grants?: string[]; denials?: string[] } | null;
      if (overrides && (overrides.grants?.length || overrides.denials?.length)) {
        for (const code of overrides.grants || []) {
          await this.prisma.staffPermissionOverride.upsert({
            where: { staff_id_permission_code: { staff_id: invite.staff_id, permission_code: code } },
            create: {
              gym_id: invite.studio_id,
              staff_id: invite.staff_id,
              permission_code: code,
              type: 'grant',
              granted_by: invite.invited_by,
            },
            update: { type: 'grant', granted_by: invite.invited_by },
          });
        }
        for (const code of overrides.denials || []) {
          await this.prisma.staffPermissionOverride.upsert({
            where: { staff_id_permission_code: { staff_id: invite.staff_id, permission_code: code } },
            create: {
              gym_id: invite.studio_id,
              staff_id: invite.staff_id,
              permission_code: code,
              type: 'deny',
              granted_by: invite.invited_by,
            },
            update: { type: 'deny', granted_by: invite.invited_by },
          });
        }
      }
    });

    // 7. Mark invite as accepted
    await this.prisma.staffInvitation.update({
      where: { id: invite.id },
      data: { status: 'accepted', accepted_at: new Date() },
    });

    this.logger.log(
      `Staff invite accepted: ${invite.email} → studio=${invite.studio_id}, role=${invite.role_name}`,
    );

    return {
      success: true,
      user_id: userId,
      studio_id: invite.studio_id,
      studio_name: studio.name,
      role: invite.role_name,
      message: 'Account created successfully. You can now log in.',
    };
  }

  /**
   * Resend an invite (creates new token, extends expiry).
   */
  async resendInvite(inviteId: string, invitedBy: string) {
    const invite = await this.prisma.staffInvitation.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === 'accepted') {
      throw new BadRequestException('This invite was already accepted');
    }

    // Revoke old + create fresh
    await this.prisma.staffInvitation.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });

    return this.createInvite({
      staff_id: invite.staff_id,
      studio_id: invite.studio_id,
      email: invite.email,
      role_name: invite.role_name,
      branch_id: invite.branch_id || undefined,
      permission_overrides: invite.permission_overrides as any,
      invited_by: invitedBy,
    });
  }

  /**
   * Revoke a pending invite.
   */
  async revokeInvite(inviteId: string) {
    const invite = await this.prisma.staffInvitation.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'pending') {
      throw new BadRequestException(`Cannot revoke a ${invite.status} invite`);
    }

    await this.prisma.staffInvitation.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });

    return { success: true };
  }

  /**
   * Get invite details by token (public — for the invite acceptance page).
   */
  async getInviteByToken(token: string) {
    const invite = await this.prisma.staffInvitation.findUnique({
      where: { token },
    });
    if (!invite) throw new NotFoundException('Invalid invite link');

    const studio = await this.prisma.studio.findUnique({
      where: { id: invite.studio_id },
      select: { name: true, logo_url: true },
    });

    return {
      email: invite.email,
      role_name: invite.role_name,
      studio_name: studio?.name || 'Unknown',
      studio_logo: studio?.logo_url,
      status: invite.status,
      is_expired: invite.expires_at < new Date(),
      expires_at: invite.expires_at,
    };
  }

  /**
   * List all invites for a studio (for admin view).
   */
  async listInvites(studioId: string, filters?: { status?: string }) {
    const where: any = { studio_id: studioId };
    if (filters?.status) where.status = filters.status;

    return this.prisma.staffInvitation.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Update permission overrides for an existing staff member.
   * Can be called at any time by the owner to adjust permissions.
   */
  async updatePermissionOverrides(params: {
    staff_id: string;
    grants: string[];
    denials: string[];
    granted_by: string;
  }) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('No tenant context');

    // Clear existing overrides
    await this.prisma.staffPermissionOverride.deleteMany({
      where: { staff_id: params.staff_id },
    });

    // Insert new grants
    for (const code of params.grants) {
      await this.prisma.staffPermissionOverride.create({
        data: {
          gym_id: gymId,
          staff_id: params.staff_id,
          permission_code: code,
          type: 'grant',
          granted_by: params.granted_by,
        },
      });
    }

    // Insert new denials
    for (const code of params.denials) {
      await this.prisma.staffPermissionOverride.create({
        data: {
          gym_id: gymId,
          staff_id: params.staff_id,
          permission_code: code,
          type: 'deny',
          granted_by: params.granted_by,
        },
      });
    }

    return { success: true, grants: params.grants.length, denials: params.denials.length };
  }

  /**
   * Get current permission overrides for a staff member.
   */
  async getPermissionOverrides(staffId: string) {
    const overrides = await this.prisma.staffPermissionOverride.findMany({
      where: { staff_id: staffId },
    });

    return {
      grants: overrides.filter((o) => o.type === 'grant').map((o) => o.permission_code),
      denials: overrides.filter((o) => o.type === 'deny').map((o) => o.permission_code),
    };
  }

  /**
   * Reset password for a staff member (owner-only, via Supabase Admin API).
   */
  async resetStaffPassword(staffId: string, newPassword: string) {
    // Find the staff record to get user_id
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (!staff.user_id) {
      throw new BadRequestException('This staff member has no login account. Send an invite first.');
    }

    const { error } = await this.supabase.auth.admin.updateUserById(staff.user_id, {
      password: newPassword,
    });

    if (error) {
      this.logger.error(`Password reset failed for staff ${staffId}: ${error.message}`);
      throw new BadRequestException(`Password reset failed: ${error.message}`);
    }

    this.logger.log(`Password reset for staff ${staffId} (user_id=${staff.user_id})`);
    return { success: true, message: 'Password has been reset successfully' };
  }

  /**
   * Fully remove a staff member's access — revoke RBAC roles, delete Supabase user (optional), deactivate.
   */
  async revokeAllAccess(staffId: string, studioId: string, deleteAuthUser: boolean = false) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    // 1. Remove RBAC roles for this user in this studio
    if (staff.user_id) {
      await this.prisma.userRole.deleteMany({
        where: { user_id: staff.user_id, studio_id: studioId },
      });

      // 2. Remove permission overrides
      await this.prisma.staffPermissionOverride.deleteMany({
        where: { staff_id: staffId },
      });

      // 3. Revoke all pending invites
      await this.prisma.staffInvitation.updateMany({
        where: { staff_id: staffId, studio_id: studioId, status: 'pending' },
        data: { status: 'revoked' },
      });

      // 4. Unlink user_id from staff record
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { schema_name: true },
      });
      if (studio) {
        await this.runInTenantScope(studio.schema_name, studioId, async () => {
          await this.prisma.staff.updateMany({
            where: { id: staffId },
            data: { user_id: null, updated_at: new Date() },
          });
        });
      }

      // 5. Optionally delete the Supabase auth user entirely
      if (deleteAuthUser) {
        const { error } = await this.supabase.auth.admin.deleteUser(staff.user_id);
        if (error) {
          this.logger.warn(`Failed to delete auth user ${staff.user_id}: ${error.message}`);
        }
      }
    }

    // 6. Deactivate staff record
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { is_active: false, status: 'inactive' },
    });

    this.logger.log(`All access revoked for staff ${staffId} in studio ${studioId}`);
    return { success: true, message: 'All access has been revoked and staff deactivated' };
  }

  // ── Private ────────────────────────────────────────────────

  /**
   * Run fn inside a tenantContext store so the PrismaService $use middleware
   * can set search_path + app.gym_id on the connection Prisma uses for the op.
   * Required for services hit by public (no-auth) routes like invite accept,
   * which don't go through TenantMiddleware.
   */
  private runInTenantScope<T>(
    schemaName: string,
    gymId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      tenantContext.run(
        { schemaName, gymId, activeBranchId: null, allowedBranchIds: [], bypassBranchScope: false },
        () => { fn().then(resolve).catch(reject); },
      );
    });
  }

  private async sendInviteEmail(
    email: string,
    data: { studio_name: string; role_name: string; invite_link: string },
  ) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    if (!resendKey) {
      this.logger.warn('RESEND_API_KEY not configured — invite email skipped');
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);

    const roleDisplay = data.role_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL', 'MuscleX <noreply@musclex.app>');
    this.logger.log(`Sending invite email from="${fromEmail}" to="${email}"`);

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to ${data.studio_name}`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #0D1B2A;">You've been invited!</h2>
          <p style="color: #5A7A9A;">
            <strong>${data.studio_name}</strong> has invited you to join as <strong>${roleDisplay}</strong>.
          </p>
          <p style="color: #5A7A9A;">Click below to set up your account and start working:</p>
          <a href="${data.invite_link}" style="
            display: inline-block;
            background: #4A9FD4;
            color: white;
            padding: 14px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 16px 0;
          ">Accept Invite</a>
          <p style="color: #B0C8E0; font-size: 12px;">
            This link expires in 7 days. If you didn't expect this, ignore it.
          </p>
        </div>
      `,
    });

    if (emailError) {
      this.logger.error(`Resend API error: ${JSON.stringify(emailError)}`);
      throw new Error(`Resend API error: ${emailError.message}`);
    }

    this.logger.log(`Invite email sent successfully: id=${emailResult?.id}`);
  }
}
