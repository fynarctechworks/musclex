import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    branch_id?: string;
    organization_id?: string;
    plan_type?: string;
    multi_branch_access?: boolean;
    is_active?: boolean;
  }) {
    const where: any = {};

    if (filters?.branch_id) {
      where.OR = [{ branch_id: filters.branch_id }, { branch_id: null }];
    }
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.plan_type) where.plan_type = filters.plan_type;
    if (filters?.multi_branch_access !== undefined) where.multi_branch_access = filters.multi_branch_access;
    if (filters?.is_active !== undefined) where.is_active = filters.is_active;

    return this.prisma.membershipPlan.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  private toIntOrNull(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? null : n;
  }

  async create(data: {
    name: string;
    description?: string;
    plan_type: string;
    duration_days?: number | string;
    total_classes?: number | string;
    max_classes_per_week?: number | string;
    max_visits?: number | string;
    price: number | string;
    currency?: string;
    branch_id?: string;
    organization_id?: string;
    multi_branch_access?: boolean;
    grace_period_days?: number;
    auto_renew_enabled?: boolean;
  }) {
    return this.prisma.membershipPlan.create({
      data: {
        name: data.name,
        description: data.description || null,
        plan_type: data.plan_type,
        duration_days: this.toIntOrNull(data.duration_days),
        total_classes: this.toIntOrNull(data.total_classes),
        max_classes_per_week: this.toIntOrNull(data.max_classes_per_week),
        max_visits: this.toIntOrNull(data.max_visits),
        price: Number(data.price),
        currency: data.currency || 'INR',
        branch_id: data.branch_id || null,
        organization_id: data.organization_id || null,
        multi_branch_access: data.multi_branch_access || false,
        grace_period_days: data.grace_period_days ?? 0,
        auto_renew_enabled: data.auto_renew_enabled || false,
      },
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      plan_type?: string;
      duration_days?: number | string;
      total_classes?: number | string;
      max_classes_per_week?: number | string;
      max_visits?: number | string;
      price?: number | string;
      currency?: string;
      branch_id?: string;
      organization_id?: string;
      multi_branch_access?: boolean;
      grace_period_days?: number;
      is_active?: boolean;
      auto_renew_enabled?: boolean;
    },
  ) {
    await this.findOne(id);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.plan_type !== undefined) updateData.plan_type = data.plan_type;
    if (data.duration_days !== undefined) updateData.duration_days = this.toIntOrNull(data.duration_days);
    if (data.total_classes !== undefined) updateData.total_classes = this.toIntOrNull(data.total_classes);
    if (data.max_classes_per_week !== undefined) updateData.max_classes_per_week = this.toIntOrNull(data.max_classes_per_week);
    if (data.max_visits !== undefined) updateData.max_visits = this.toIntOrNull(data.max_visits);
    if (data.price !== undefined) updateData.price = Number(data.price);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.branch_id !== undefined) updateData.branch_id = data.branch_id || null;
    if (data.organization_id !== undefined) updateData.organization_id = data.organization_id || null;
    if (data.multi_branch_access !== undefined) updateData.multi_branch_access = data.multi_branch_access;
    if (data.grace_period_days !== undefined) updateData.grace_period_days = data.grace_period_days;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.auto_renew_enabled !== undefined) updateData.auto_renew_enabled = data.auto_renew_enabled;

    return this.prisma.membershipPlan.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.membershipPlan.update({
      where: { id },
      data: { is_active: false },
    });
    return { success: true };
  }

  async findByType(planType: string) {
    return this.prisma.membershipPlan.findMany({
      where: { plan_type: planType, is_active: true },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { price: 'asc' },
    });
  }
}
