import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto';

/**
 * Default categories auto-provisioned on branch creation.
 * These mirror the legacy hard-coded enum so existing data still resolves.
 */
export const DEFAULT_EXPENSE_CATEGORIES: Array<{
  slug: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}> = [
  { slug: 'salaries', name: 'Salaries', icon: 'users', color: '#4A9FD4', sort_order: 1 },
  { slug: 'rent', name: 'Rent', icon: 'home', color: '#6BBFE8', sort_order: 2 },
  { slug: 'equipment', name: 'Equipment', icon: 'dumbbell', color: '#34C77A', sort_order: 3 },
  { slug: 'utilities', name: 'Utilities', icon: 'zap', color: '#F59E0B', sort_order: 4 },
  { slug: 'marketing', name: 'Marketing', icon: 'megaphone', color: '#EF4444', sort_order: 5 },
  { slug: 'maintenance', name: 'Maintenance', icon: 'wrench', color: '#B0C8E0', sort_order: 6 },
  { slug: 'other', name: 'Other', icon: 'package', color: '#5A7A9A', sort_order: 99 },
];

@Injectable()
export class ExpenseCategoriesService {
  private readonly logger = new Logger(ExpenseCategoriesService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  /**
   * Returns the active category set visible to a given branch.
   * Precedence: branch-specific overrides gym-wide (same slug) — we return both sorted.
   */
  async listCategories(opts: { branch_id?: string; include_inactive?: boolean } = {}) {
    const gymId = getTenantGymId()!;
    const where: any = { gym_id: gymId };
    if (!opts.include_inactive) where.is_active = true;
    if (opts.branch_id) {
      where.OR = [{ branch_id: opts.branch_id }, { branch_id: null }];
    }
    return this.tenant.client.expenseCategory.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async findBySlug(slug: string, branchId?: string | null) {
    const gymId = getTenantGymId()!;
    // Prefer branch-specific override, fall back to gym-wide (branch_id: null)
    if (branchId) {
      const scoped = await this.tenant.client.expenseCategory.findFirst({
        where: { gym_id: gymId, branch_id: branchId, slug },
      });
      if (scoped) return scoped;
    }
    return this.tenant.client.expenseCategory.findFirst({
      where: { gym_id: gymId, branch_id: null, slug },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const gymId = getTenantGymId()!;
    const slug = this.slugify(dto.name);
    if (!slug) throw new ConflictException('Category name must contain alphanumeric characters');

    // Uniqueness on (gym_id, branch_id, slug)
    const existing = await this.tenant.client.expenseCategory.findFirst({
      where: { gym_id: gymId, branch_id: dto.branch_id ?? null, slug },
    });
    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists for this scope`);
    }

    return this.tenant.client.expenseCategory.create({
      data: {
        gym_id: gymId,
        branch_id: dto.branch_id ?? null,
        name: dto.name,
        slug,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        is_default: dto.is_default ?? false,
        sort_order: dto.sort_order ?? 50,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.tenant.client.expenseCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    // Defaults cannot be deactivated; only renamed/re-iconed
    if (category.is_default && dto.is_active === false) {
      throw new ConflictException('Default categories cannot be deactivated');
    }

    return this.tenant.client.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });
  }

  async deactivateCategory(id: string) {
    return this.updateCategory(id, { is_active: false });
  }

  /**
   * Idempotent upsert of the default category set for a branch.
   * Safe to call on every branch-create and on demand from ExpenseEventsService.
   */
  async ensureDefaultsForBranch(branchId?: string | null): Promise<void> {
    const gymId = getTenantGymId();
    if (!gymId) return;

    for (const def of DEFAULT_EXPENSE_CATEGORIES) {
      try {
        await this.tenant.client.expenseCategory.upsert({
          where: {
            gym_id_branch_id_slug: {
              gym_id: gymId,
              branch_id: branchId ?? null,
              slug: def.slug,
            },
          } as any,
          create: {
            gym_id: gymId,
            branch_id: branchId ?? null,
            name: def.name,
            slug: def.slug,
            icon: def.icon,
            color: def.color,
            is_default: true,
            sort_order: def.sort_order,
          },
          update: {}, // no-op — preserve any edits the studio made
        });
      } catch (err) {
        this.logger.warn(
          `ensureDefaultsForBranch: failed to upsert "${def.slug}" for branch=${branchId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
