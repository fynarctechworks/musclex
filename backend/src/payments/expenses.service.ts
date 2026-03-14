import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'equipment'
  | 'utilities'
  | 'marketing'
  | 'maintenance'
  | 'other';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    branch_id: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    expense_date: string;
    receipt_url?: string;
    recorded_by_staff_id: string;
  }) {
    return this.prisma.expense.create({
      data: {
        branch_id: data.branch_id,
        category: data.category,
        description: data.description,
        amount: data.amount,
        expense_date: new Date(data.expense_date),
        receipt_url: data.receipt_url,
        recorded_by_staff_id: data.recorded_by_staff_id,
      },
      include: {
        branch: { select: { id: true, name: true } },
        recorded_by: { select: { id: true, full_name: true } },
      },
    });
  }

  async findAll(query: {
    branch_id?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, category, date_from, date_to, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (branch_id) where.branch_id = branch_id;
    if (category) where.category = category;
    if (date_from || date_to) {
      where.expense_date = {};
      if (date_from) where.expense_date.gte = new Date(date_from);
      if (date_to) where.expense_date.lte = new Date(date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          recorded_by: { select: { id: true, full_name: true } },
        },
        skip,
        take: limit,
        orderBy: { expense_date: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async update(
    id: string,
    data: {
      category?: ExpenseCategory;
      description?: string;
      amount?: number;
      expense_date?: string;
      receipt_url?: string;
    },
  ) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...data,
        expense_date: data.expense_date ? new Date(data.expense_date) : undefined,
      },
      include: {
        branch: { select: { id: true, name: true } },
        recorded_by: { select: { id: true, full_name: true } },
      },
    });
  }

  async remove(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    await this.prisma.expense.delete({ where: { id } });
    return { deleted: true };
  }
}
