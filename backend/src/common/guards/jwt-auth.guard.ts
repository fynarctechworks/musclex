import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PermissionsMap, UserRoleSummary } from '../decorators/current-user.decorator';
import { DEFAULT_ROLE_PERMISSIONS } from './default-permissions';
import { RbacService } from '../../auth/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionPolicyService } from '../services/subscription-policy.service';
import * as jose from 'jose';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwtSecret: Uint8Array | null = null;

  constructor(
    private configService: ConfigService,
    private rbacService: RbacService,
    private prisma: PrismaService,
    private subscriptionPolicy: SubscriptionPolicyService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );

    const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      this.jwtSecret = new TextEncoder().encode(secret);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // Prefer local JWT verification (no network call) over Supabase getUser
      let user: { id: string; email?: string; user_metadata: Record<string, any> };

      if (this.jwtSecret) {
        try {
          const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
            issuer: this.configService.get<string>('SUPABASE_URL') + '/auth/v1',
          });
          user = {
            id: payload.sub!,
            email: payload.email as string | undefined,
            user_metadata: (payload.user_metadata as Record<string, any>) || {},
          };
        } catch {
          // Local verification failed — fall back to network call
          const { data, error } = await this.supabase.auth.getUser(token);
          if (error || !data.user) throw new UnauthorizedException('Invalid or expired token');
          user = { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata || {} };
        }
      } else {
        // No JWT secret configured — use network call
        const { data, error } = await this.supabase.auth.getUser(token);
        if (error || !data.user) throw new UnauthorizedException('Invalid or expired token');
        user = { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata || {} };
      }

      // Verify user exists in our DB — catches wiped/deleted users with live tokens
      const dbUser = await this.prisma.userIdentity.findUnique({
        where: { id: user.id },
        select: { id: true },
      });
      if (!dbUser) {
        throw new UnauthorizedException('User not found');
      }

      const metadata = user.user_metadata || {};
      const studioId = metadata.studio_id;
      const organizationId = metadata.organization_id as string | undefined;

      // ── Resolve from normalized RBAC tables ──
      let role = metadata.role || 'owner';
      let roles: UserRoleSummary[] = [];
      let branchIds: string[] = metadata.branch_ids || [];
      let permissions: PermissionsMap = {};
      let permissionCodes: string[] = [];

      if (studioId) {
        try {
          // Get all roles for this user in this studio
          const userRoles = await this.rbacService.getUserRoles(user.id, studioId);

          if (userRoles.length > 0) {
            roles = userRoles.map((r) => ({
              role_name: r.role_name,
              branch_id: r.branch_id,
              is_primary: r.is_primary,
            }));

            // Primary role
            const primaryRole = userRoles.find((r) => r.is_primary) || userRoles[0];
            role = primaryRole.role_name;

            // Branch access from roles
            const hasGlobalAccess = userRoles.some((r) => r.branch_id === null);
            if (!hasGlobalAccess) {
              branchIds = [...new Set(
                userRoles.filter((r) => r.branch_id).map((r) => r.branch_id!),
              )];
            }

            // Resolve permissions from normalized tables
            const branchId = request.headers['x-branch-id'] as string | undefined;
            permissionCodes = await this.rbacService.resolvePermissions(
              user.id,
              studioId,
              branchId,
            );
            permissions = this.rbacService.codesToPermissionsMap(permissionCodes);
          }
        } catch (error) {
          this.logger.warn(`RBAC resolution failed for user ${user.id} in studio ${studioId}`, error instanceof Error ? error.message : error);
          // Fall through to legacy resolution below
        }
      }

      // ── Fallback: legacy resolution from metadata/defaults ──
      if (Object.keys(permissions).length === 0) {
        permissions = metadata.permissions || DEFAULT_ROLE_PERMISSIONS[role] || {};
        // Convert to codes for backward compat
        for (const [mod, actions] of Object.entries(permissions)) {
          for (const action of actions as string[]) {
            permissionCodes.push(`${mod}.${action}`);
          }
        }
      }

      // Resolve subscription lifecycle context (cached, ~1ms after warmup).
      // Skipped during onboarding (no studio_id yet).
      let subscription = undefined as
        | Awaited<ReturnType<SubscriptionPolicyService['getContext']>>
        | undefined;
      if (studioId) {
        try {
          subscription = await this.subscriptionPolicy.getContext(studioId);
        } catch (err) {
          this.logger.warn(
            `Failed to resolve subscription context for studio ${studioId}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }

      request.user = {
        user_id: user.id,
        studio_id: studioId,
        organization_id: organizationId,
        role,
        roles,
        branch_ids: branchIds,
        branch_id: request.headers['x-branch-id'],
        email: user.email,
        permissions,
        permission_codes: permissionCodes,
        subscription,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
