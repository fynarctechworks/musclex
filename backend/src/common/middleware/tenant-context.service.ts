import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { JwtPayload } from '../decorators/current-user.decorator';
import { getTenantGymId } from '../tenant-context';

/**
 * Request-scoped service that provides the current tenant context.
 * Use this in services that need to validate tenant ownership of records.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get user(): JwtPayload | undefined {
    return (this.request as any).user;
  }

  get studioId(): string | undefined {
    return this.user?.studio_id;
  }

  /** The gym_id used for tenant isolation filtering (same as studioId) */
  get gymId(): string | undefined {
    return getTenantGymId() || this.studioId;
  }

  get branchId(): string | undefined {
    return this.user?.branch_id;
  }

  get branchIds(): string[] {
    return this.user?.branch_ids || [];
  }

  get userId(): string | undefined {
    return this.user?.user_id;
  }

  /**
   * Returns a where-clause filter that scopes queries to the current tenant's branches.
   */
  get branchFilter(): { branch_id: { in: string[] } } | Record<string, never> {
    if (this.branchIds.length > 0) {
      return { branch_id: { in: this.branchIds } };
    }
    return {};
  }
}
