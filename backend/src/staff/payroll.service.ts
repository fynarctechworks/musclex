import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { UpsertPayrollConfigDto } from './dto/upsert-payroll-config.dto';
import { ProcessPayrollDto, UpdatePayrollRecordDto } from './dto/process-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private tenant: TenantPrisma) {}

  // ── Payroll Config ────────────────────────────────────────────

  async getConfig(staffId: string) {
    const config = await this.tenant.client.payrollConfig.findUnique({
      where: { staff_id: staffId },
      include: {
        staff: { select: { id: true, full_name: true, role: true, employee_code: true } },
      },
    });
    if (!config) throw new NotFoundException('Payroll config not found');
    return config;
  }

  async upsertConfig(dto: UpsertPayrollConfigDto) {
    const staff = await this.tenant.client.staff.findUnique({
      where: { id: dto.staff_id },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.tenant.client.payrollConfig.upsert({
      where: { staff_id: dto.staff_id },
      update: {
        ...(dto.salary_type !== undefined && { salary_type: dto.salary_type }),
        ...(dto.base_salary !== undefined && { base_salary: dto.base_salary }),
        ...(dto.commission_percentage !== undefined && {
          commission_percentage: dto.commission_percentage,
        }),
        ...(dto.bonus_structure !== undefined && {
          bonus_structure: dto.bonus_structure,
        }),
      },
      create: {
        gym_id: getTenantGymId()!,
        staff_id: dto.staff_id,
        salary_type: dto.salary_type ?? 'fixed',
        base_salary: dto.base_salary ?? 0,
        commission_percentage: dto.commission_percentage ?? 0,
        bonus_structure: dto.bonus_structure ?? {},
      },
      include: {
        staff: { select: { id: true, full_name: true, role: true } },
      },
    });
  }

  // ── Trainer Revenue ───────────────────────────────────────────

  async recordRevenue(data: {
    trainer_id: string;
    branch_id: string;
    session_id?: string;
    revenue_amount: number;
    commission_amount: number;
  }) {
    return this.tenant.client.trainerRevenue.create({ data: { ...data, gym_id: getTenantGymId()! } });
  }

  async getRevenueReport(filters: {
    trainer_id?: string;
    branch_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const where: any = {};
    if (filters.trainer_id) where.trainer_id = filters.trainer_id;
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) where.created_at.gte = new Date(filters.start_date);
      if (filters.end_date) where.created_at.lte = new Date(filters.end_date);
    }

    const [records, aggregate] = await Promise.all([
      this.tenant.client.trainerRevenue.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          trainer: { select: { id: true, full_name: true, employee_code: true } },
          branch: { select: { id: true, name: true } },
          session: { select: { id: true, session_type: true, session_date: true } },
        },
      }),
      this.tenant.client.trainerRevenue.aggregate({
        where,
        _sum: { revenue_amount: true, commission_amount: true },
        _count: true,
      }),
    ]);

    return {
      records,
      summary: {
        total_revenue: Number(aggregate._sum.revenue_amount ?? 0),
        total_commission: Number(aggregate._sum.commission_amount ?? 0),
        total_records: aggregate._count,
      },
    };
  }

  // ── Payroll Summary ───────────────────────────────────────────

  async getPayrollSummary(filters?: {
    branch_id?: string;
    organization_id?: string;
  }) {
    const staffWhere: any = { is_active: true };
    if (filters?.branch_id) {
      staffWhere.OR = [
        { branch_id: filters.branch_id },
        { branch_ids: { has: filters.branch_id } },
      ];
    }
    if (filters?.organization_id) {
      staffWhere.organization_id = filters.organization_id;
    }

    const staffWithPayroll = await this.tenant.client.staff.findMany({
      where: staffWhere,
      include: {
        payroll_config: true,
        primary_branch: { select: { id: true, name: true } },
        trainer_revenue: {
          where: {
            created_at: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
      },
    });

    return staffWithPayroll.map((staff) => {
      const config = staff.payroll_config;
      const monthlyRevenue = staff.trainer_revenue.reduce(
        (sum, r) => sum + Number(r.revenue_amount),
        0,
      );
      const monthlyCommission = staff.trainer_revenue.reduce(
        (sum, r) => sum + Number(r.commission_amount),
        0,
      );

      const { salary, ...staffData } = staff as any;
      return {
        staff_id: staffData.id,
        full_name: staffData.full_name,
        employee_code: staffData.employee_code,
        role: staffData.role,
        branch: staffData.primary_branch,
        payroll: config
          ? {
              salary_type: config.salary_type,
              base_salary: Number(config.base_salary),
              commission_percentage: Number(config.commission_percentage),
            }
          : null,
        current_month: {
          revenue_generated: monthlyRevenue,
          commission_earned: monthlyCommission,
          total_payout:
            Number(config?.base_salary ?? staff.salary ?? 0) + monthlyCommission,
        },
      };
    });
  }

  // ── Payroll Records (Pay Runs) ────────────────────────────────

  async processPayroll(dto: ProcessPayrollDto) {
    const staff = await this.tenant.client.staff.findUnique({
      where: { id: dto.staff_id },
      include: { payroll_config: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const periodStart = new Date(dto.salary_period_start);
    const periodEnd = new Date(dto.salary_period_end);
    if (periodEnd <= periodStart) {
      throw new BadRequestException('Period end must be after period start');
    }

    // Wrap duplicate check + creation in transaction to prevent race condition
    return this.tenant.client.$transaction(async (tx) => {
      // Check for duplicate payroll run in same period
      const existing = await tx.payrollRecord.findFirst({
        where: {
          staff_id: dto.staff_id,
          salary_period_start: periodStart,
          salary_period_end: periodEnd,
        },
      });
      if (existing) throw new BadRequestException('Payroll already processed for this period');

      // Calculate commission from revenue in the period
      const revenueAgg = await tx.trainerRevenue.aggregate({
        where: {
          trainer_id: dto.staff_id,
          created_at: { gte: periodStart, lte: periodEnd },
        },
        _sum: { commission_amount: true },
      });

      const baseSalary = Number(staff.payroll_config?.base_salary ?? staff.salary ?? 0);
      const commission = Number(revenueAgg._sum.commission_amount ?? 0);
      const bonus = dto.bonus ?? 0;
      const deductions = dto.deductions ?? 0;
      const totalPaid = baseSalary + commission + bonus - deductions;

      return tx.payrollRecord.create({
        data: {
          gym_id: getTenantGymId()!,
          staff_id: dto.staff_id,
          salary_period_start: periodStart,
          salary_period_end: periodEnd,
          base_salary: baseSalary,
          commission,
          bonus,
          deductions,
          total_paid: totalPaid,
          notes: dto.notes,
        },
        include: {
          staff: { select: { id: true, full_name: true, employee_code: true, role: true } },
        },
      });
    });
  }

  async getPayrollRecords(filters: {
    staff_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const { staff_id, status, start_date, end_date, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (staff_id) where.staff_id = staff_id;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.salary_period_start = {};
      if (start_date) where.salary_period_start.gte = new Date(start_date);
      if (end_date) where.salary_period_start.lte = new Date(end_date);
    }

    const [data, total] = await Promise.all([
      this.tenant.client.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { salary_period_start: 'desc' },
        include: {
          staff: {
            select: { id: true, full_name: true, employee_code: true, role: true },
          },
        },
      }),
      this.tenant.client.payrollRecord.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updatePayrollRecord(id: string, dto: UpdatePayrollRecordDto) {
    const record = await this.tenant.client.payrollRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Payroll record not found');
    if (record.status === 'paid') {
      throw new BadRequestException('Cannot modify a paid payroll record');
    }

    const updateData: any = {};
    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === 'paid') updateData.paid_at = new Date();
    }
    if (dto.bonus !== undefined) updateData.bonus = dto.bonus;
    if (dto.deductions !== undefined) updateData.deductions = dto.deductions;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    // Recalculate total if bonus or deductions changed
    if (dto.bonus !== undefined || dto.deductions !== undefined) {
      const bonus = dto.bonus ?? Number(record.bonus);
      const deductions = dto.deductions ?? Number(record.deductions);
      updateData.total_paid =
        Number(record.base_salary) + Number(record.commission) + bonus - deductions;
    }

    return this.tenant.client.payrollRecord.update({
      where: { id },
      data: updateData,
      include: {
        staff: { select: { id: true, full_name: true, employee_code: true } },
      },
    });
  }
}
