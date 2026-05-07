import { PrismaClient } from '@prisma/client';
import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { getActiveBranchId, isBranchScopeBypassed } from '../common/tenant-context';
import { getBranchScopeTier } from '../common/branch-scope.registry';

const logger = new Logger('BranchScopeExtension');

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_CREATE_OPS = new Set(['create', 'createMany']);
const WRITE_MUTATION_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);

function injectBranchWhere(where: any, branchId: string): any {
  if (!where) return { branch_id: branchId };
  return { ...where, branch_id: branchId };
}

function injectSharedBranchWhere(where: any, branchId: string): any {
  const branchFilter = { OR: [{ branch_id: branchId }, { branch_id: null }] };
  if (!where) return branchFilter;
  return { AND: [where, branchFilter] };
}

/**
 * Branch-scope Prisma extension.
 *
 * STRICT models: enforced — auto-injects branch_id on reads/writes.
 * SHARED_OR_BRANCHED models: observe-only — logs missing filters.
 * GYM_WIDE models: no-op.
 */
export function createBranchScopeExtension(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (isBranchScopeBypassed()) return query(args);

          const activeBranchId = getActiveBranchId();
          if (!activeBranchId) return query(args);

          const tier = getBranchScopeTier(model);
          if (tier === 'GYM_WIDE') return query(args);

          // ── STRICT: enforce branch isolation ──
          if (tier === 'STRICT') {
            if (READ_OPS.has(operation)) {
              (args as any).where = injectBranchWhere((args as any).where, activeBranchId);
              return query(args);
            }

            if (WRITE_CREATE_OPS.has(operation)) {
              const data = (args as any).data;
              if (Array.isArray(data)) {
                for (const item of data) {
                  if (!item.branch_id) {
                    item.branch_id = activeBranchId;
                  } else if (item.branch_id !== activeBranchId) {
                    throw new ForbiddenException('CROSS_BRANCH_WRITE');
                  }
                }
              } else if (data) {
                if (!data.branch_id) {
                  data.branch_id = activeBranchId;
                } else if (data.branch_id !== activeBranchId) {
                  throw new ForbiddenException('CROSS_BRANCH_WRITE');
                }
              }
              return query(args);
            }

            if (WRITE_MUTATION_OPS.has(operation)) {
              if (operation === 'upsert') {
                (args as any).where = injectBranchWhere((args as any).where, activeBranchId);
                const create = (args as any).create;
                if (create && !create.branch_id) create.branch_id = activeBranchId;
              } else {
                (args as any).where = injectBranchWhere((args as any).where, activeBranchId);
              }
              return query(args);
            }

            return query(args);
          }

          // ── SHARED_OR_BRANCHED: enforce — include branch-scoped + gym-wide (null) rows ──
          if (READ_OPS.has(operation)) {
            (args as any).where = injectSharedBranchWhere((args as any).where, activeBranchId);
            return query(args);
          }

          if (WRITE_MUTATION_OPS.has(operation)) {
            if (operation === 'upsert') {
              (args as any).where = injectSharedBranchWhere((args as any).where, activeBranchId);
            } else {
              (args as any).where = injectSharedBranchWhere((args as any).where, activeBranchId);
            }
            return query(args);
          }

          // Creates: no auto-inject — branch_id is intentionally nullable
          return query(args);
        },
      },
    },
  });
}

export type BranchScopedPrismaClient = ReturnType<typeof createBranchScopeExtension>;
