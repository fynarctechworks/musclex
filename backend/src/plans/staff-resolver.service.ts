import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';

/**
 * Maps the authenticated platform user (Supabase user id from the JWT) to the
 * gym's Staff row, for created_by/assigned_by attribution. Owners without a
 * staff row resolve to null — the columns are nullable by design.
 */
@Injectable()
export class StaffResolverService {
  constructor(private readonly tenant: TenantPrisma) {}

  async resolveStaffId(userId: string | undefined): Promise<string | null> {
    if (!userId) return null;
    const staff = await this.tenant.client.staff.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });
    return staff?.id ?? null;
  }
}
