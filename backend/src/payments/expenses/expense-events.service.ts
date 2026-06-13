import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import { ExpenseCategoriesService } from './expense-categories.service';
import type { CreateExpenseDto, ExpenseFiltersDto } from './dto';

export const EXPENSE_CREATED_EVENT = 'expense.created';
export const EXPENSE_REVERSED_EVENT = 'expense.reversed';

export interface ExpenseEventPayload {
  gym_id: string;
  branch_id: string;
  expense_id: string;
  amount: number; // signed
  category_id: string | null;
  expense_date: string; // yyyy-mm-dd
  status: 'confirmed' | 'reversed';
}

@Injectable()
export class ExpenseEventsService {
  private readonly logger = new Logger(ExpenseEventsService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly categories: ExpenseCategoriesService,
    private readonly events: EventEmitter2,
  ) {}

  // ───────────────────────────────────────────────────────────────
  // Create immutable expense event
  // ───────────────────────────────────────────────────────────────
  async createExpense(
    dto: CreateExpenseDto,
    userContext: { staff_id?: string | null },
  ) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Missing tenant context');
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('amount must be positive');
    }

    // Idempotency short-circuit — if we've already processed this key, return the existing row.
    if (dto.idempotency_key) {
      const existing = await this.tenant.client.expense.findFirst({
        where: { idempotency_key: dto.idempotency_key },
        include: this.expenseInclude(),
      });
      if (existing) return existing;
    }

    // Resolve category — prefer explicit id, then slug, then auto-ensure defaults and lookup
    let categoryId: string | null = dto.category_id ?? null;
    let categorySlug: string = dto.category ?? 'other';

    if (!categoryId && dto.category) {
      const found = await this.categories.findBySlug(dto.category, dto.branch_id);
      if (found) {
        categoryId = found.id;
        categorySlug = found.slug;
      } else {
        // auto-provision defaults if this gym has no categories yet
        await this.categories.ensureDefaultsForBranch(null);
        const retry = await this.categories.findBySlug(dto.category, dto.branch_id);
        if (retry) {
          categoryId = retry.id;
          categorySlug = retry.slug;
        }
      }
    } else if (categoryId) {
      const cat = await this.tenant.client.expenseCategory.findUnique({
        where: { id: categoryId },
      });
      if (cat) categorySlug = cat.slug;
    }

    const staffId = dto.recorded_by_staff_id ?? userContext.staff_id ?? null;

    try {
      const expense = await this.tenant.client.$transaction(async (tx) => {
        const created = await tx.expense.create({
          data: {
            gym_id: gymId,
            branch_id: dto.branch_id,
            category: categorySlug,
            category_id: categoryId,
            description: dto.description,
            amount: dto.amount,
            expense_date: new Date(dto.expense_date),
            receipt_url: dto.receipt_url ?? null,
            vendor: dto.vendor ?? null,
            notes: dto.notes ?? null,
            payment_method: dto.payment_method ?? 'cash',
            status: 'confirmed',
            idempotency_key: dto.idempotency_key ?? null,
            recorded_by_staff_id: staffId!,
          },
        });

        // Append to canonical financial ledger — source of truth for P&L
        await tx.financialTransaction.create({
          data: {
            gym_id: gymId,
            branch_id: dto.branch_id,
            reference_type: 'expense',
            reference_id: created.id,
            transaction_type: 'debit',
            amount: dto.amount,
            description:
              `Expense: ${dto.description.slice(0, 80)}${dto.description.length > 80 ? '…' : ''}`,
          },
        });

        return created;
      });

      // Emit event for metric rollup (synchronous listener inside same process)
      const payload: ExpenseEventPayload = {
        gym_id: gymId,
        branch_id: expense.branch_id,
        expense_id: expense.id,
        amount: Number(expense.amount),
        category_id: expense.category_id,
        expense_date: expense.expense_date.toISOString().slice(0, 10),
        status: 'confirmed',
      };
      this.events.emit(EXPENSE_CREATED_EVENT, payload);

      return this.tenant.client.expense.findUnique({
        where: { id: expense.id },
        include: this.expenseInclude(),
      });
    } catch (err: any) {
      // P2002 on the (gym_id, idempotency_key) partial unique — race condition, return existing.
      if (err?.code === 'P2002' && dto.idempotency_key) {
        const existing = await this.tenant.client.expense.findFirst({
          where: { idempotency_key: dto.idempotency_key },
          include: this.expenseInclude(),
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────
  // Reverse (append reversal entry) — immutable, original preserved
  // ───────────────────────────────────────────────────────────────
  async reverseExpense(
    id: string,
    opts: { reason?: string; notes?: string },
    userContext: { staff_id?: string | null },
  ) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Missing tenant context');

    const original = await this.tenant.client.expense.findUnique({
      where: { id },
      include: { reversed_by: true },
    });
    if (!original) throw new NotFoundException('Expense not found');
    if (original.status === 'reversed') {
      throw new ConflictException('Expense has already been reversed');
    }
    if (original.reference_id) {
      throw new ConflictException('Cannot reverse a reversal entry');
    }

    const staffId = userContext.staff_id ?? original.recorded_by_staff_id;
    const absAmount = Math.abs(Number(original.amount));

    const reversal = await this.tenant.client.$transaction(async (tx) => {
      // 1. Create the reversal row (negated amount, points at original)
      const rev = await tx.expense.create({
        data: {
          gym_id: gymId,
          branch_id: original.branch_id,
          category: original.category,
          category_id: original.category_id,
          description: `REVERSAL: ${original.description}${opts.reason ? ` (${opts.reason})` : ''}`,
          amount: -absAmount,
          expense_date: original.expense_date,
          receipt_url: original.receipt_url,
          vendor: original.vendor,
          notes: opts.notes ?? opts.reason ?? null,
          payment_method: original.payment_method,
          status: 'reversed',
          reference_id: original.id,
          recorded_by_staff_id: staffId!,
        },
      });

      // 2. Flip original's status so it no longer appears as confirmed
      await tx.expense.update({
        where: { id: original.id },
        data: { status: 'reversed' },
      });

      // 3. Inverse ledger entry (credit) linked to the reversal
      await tx.financialTransaction.create({
        data: {
          gym_id: gymId,
          branch_id: original.branch_id,
          reference_type: 'expense',
          reference_id: rev.id,
          transaction_type: 'credit',
          amount: absAmount,
          description: `Expense reversal of ${original.id}`,
        },
      });

      return rev;
    });

    // Emit two events — one for the new reversal row, one to decrement the original
    const basePayload = {
      gym_id: gymId,
      branch_id: original.branch_id,
      category_id: original.category_id,
      expense_date: original.expense_date.toISOString().slice(0, 10),
    };
    this.events.emit(EXPENSE_REVERSED_EVENT, {
      ...basePayload,
      expense_id: reversal.id,
      amount: -absAmount,
      status: 'reversed',
    });

    return this.tenant.client.expense.findUnique({
      where: { id: reversal.id },
      include: this.expenseInclude(),
    });
  }

  // ───────────────────────────────────────────────────────────────
  // Read APIs
  // ───────────────────────────────────────────────────────────────
  async getExpenseById(id: string) {
    const expense = await this.tenant.client.expense.findUnique({
      where: { id },
      include: {
        ...this.expenseInclude(),
        reversed_by: { include: this.expenseInclude() },
        reversal_of: { include: this.expenseInclude() },
      },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async findAll(filters: ExpenseFiltersDto) {
    const where = this.buildWhere(filters);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const [data, total] = await Promise.all([
      this.tenant.client.expense.findMany({
        where,
        include: this.expenseInclude(),
        orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.tenant.client.expense.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getTimeline(filters: ExpenseFiltersDto) {
    // Fetch a fat page (timeline grouping happens in memory)
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 100;
    const where = this.buildWhere(filters);

    const [rows, total] = await Promise.all([
      this.tenant.client.expense.findMany({
        where,
        include: this.expenseInclude(),
        orderBy: [{ expense_date: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.tenant.client.expense.count({ where }),
    ]);

    // Group by calendar day
    const byDay = new Map<string, { date: string; total: number; count: number; expenses: any[] }>();
    for (const r of rows) {
      const key = r.expense_date.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { date: key, total: 0, count: 0, expenses: [] });
      const g = byDay.get(key)!;
      g.expenses.push(r);
      // Only confirmed+reversal rows contribute to signed total; skip pre-reverse rows
      if (r.status !== 'reversed' || r.reference_id) {
        g.total += Number(r.amount);
      }
      g.count += 1;
    }
    const groups = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
    return { groups, total, page, limit };
  }

  // ───────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────
  private buildWhere(filters: ExpenseFiltersDto) {
    const where: any = {};
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.category_id) where.category_id = filters.category_id;
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.date_from || filters.date_to) {
      where.expense_date = {};
      if (filters.date_from) where.expense_date.gte = new Date(filters.date_from);
      if (filters.date_to) where.expense_date.lte = new Date(filters.date_to);
    }
    return where;
  }

  private expenseInclude() {
    return {
      branch: { select: { id: true, name: true } },
      recorded_by: { select: { id: true, full_name: true } },
      category_ref: {
        select: { id: true, name: true, slug: true, icon: true, color: true },
      },
    };
  }
}
