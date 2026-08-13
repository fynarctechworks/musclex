import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { AssignDietPlanDto, CreateDietPlanDto, DietPlanMealDto, UpdateDietPlanDto } from './dto';

/**
 * Staff-side diet plan CRUD + assignment (the prescription counterpart to the
 * member app's self-tracked nutrition). One active assigned diet plan per
 * member — assigning a new one cancels the previous.
 */
@Injectable()
export class DietPlansService {
  constructor(private readonly tenant: TenantPrisma) {}

  async findAll(filters: { search?: string; is_template?: string; is_active?: string; page?: number; limit?: number }) {
    const { search, is_template, is_active, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (is_template !== undefined) where.is_template = is_template === 'true';
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const [data, total] = await Promise.all([
      this.tenant.client.dietPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          created_by: { select: { id: true, full_name: true } },
          _count: { select: { meals: true, assignments: true } },
        },
      }),
      this.tenant.client.dietPlan.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const plan = await this.tenant.client.dietPlan.findUnique({
      where: { id },
      include: {
        created_by: { select: { id: true, full_name: true } },
        meals: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }] },
      },
    });
    if (!plan) throw new NotFoundException('Diet plan not found');
    return plan;
  }

  async create(dto: CreateDietPlanDto, staffId: string | null) {
    const gymId = getTenantGymId()!;
    return this.tenant.client.dietPlan.create({
      data: {
        gym_id: gymId,
        title: dto.title,
        description: dto.description,
        goal: dto.goal,
        daily_calories: dto.daily_calories,
        protein_g: dto.protein_g,
        carbs_g: dto.carbs_g,
        fat_g: dto.fat_g,
        is_template: dto.is_template ?? true,
        created_by_staff_id: staffId,
        meals: dto.meals?.length ? { create: dto.meals.map((m, i) => this.mealData(m, i, gymId)) } : undefined,
      },
      include: { meals: { orderBy: { position: 'asc' } } },
    });
  }

  async update(id: string, dto: UpdateDietPlanDto) {
    await this.findOne(id);
    const gymId = getTenantGymId()!;
    const { meals, ...fields } = dto;

    return this.tenant.client.$transaction(async (tx) => {
      if (meals) {
        await tx.dietPlanMeal.deleteMany({ where: { diet_plan_id: id } });
        if (meals.length) {
          await tx.dietPlanMeal.createMany({
            data: meals.map((m, i) => ({ ...this.mealData(m, i, gymId), diet_plan_id: id })),
          });
        }
      }
      return tx.dietPlan.update({
        where: { id },
        data: fields,
        include: { meals: { orderBy: { position: 'asc' } } },
      });
    });
  }

  /** Soft delete — assignment history must survive. */
  async remove(id: string) {
    await this.findOne(id);
    await this.tenant.client.dietPlan.update({ where: { id }, data: { is_active: false } });
    return { success: true };
  }

  async assign(planId: string, dto: AssignDietPlanDto, staffId: string | null) {
    const plan = await this.findOne(planId);
    if (!plan.is_active) throw new BadRequestException('Cannot assign an inactive plan');
    if (dto.ends_on && new Date(dto.ends_on) < new Date(dto.starts_on)) {
      throw new BadRequestException('ends_on cannot be before starts_on');
    }

    const member = await this.tenant.client.member.findFirst({
      where: { id: dto.member_id },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const gymId = getTenantGymId()!;
    return this.tenant.client.$transaction(async (tx) => {
      // Latest wins: a member follows one prescribed diet at a time.
      await tx.assignedDietPlan.updateMany({
        where: { member_id: dto.member_id, status: 'active' },
        data: { status: 'cancelled' },
      });
      return tx.assignedDietPlan.create({
        data: {
          gym_id: gymId,
          member_id: dto.member_id,
          diet_plan_id: planId,
          assigned_by_staff_id: staffId,
          starts_on: new Date(dto.starts_on),
          ends_on: dto.ends_on ? new Date(dto.ends_on) : null,
          notes: dto.notes,
        },
        include: { diet_plan: { select: { id: true, title: true } } },
      });
    });
  }

  async assignments(filters: { member_id?: string; status?: string; page?: number; limit?: number }) {
    const { member_id, status, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (member_id) where.member_id = member_id;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.tenant.client.assignedDietPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          diet_plan: { select: { id: true, title: true, goal: true, daily_calories: true } },
          member: { select: { id: true, full_name: true, member_code: true } },
        },
      }),
      this.tenant.client.assignedDietPlan.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async cancelAssignment(assignmentId: string) {
    const assignment = await this.tenant.client.assignedDietPlan.findFirst({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.tenant.client.assignedDietPlan.update({
      where: { id: assignmentId },
      data: { status: 'cancelled' },
    });
    return { success: true };
  }

  private mealData(m: DietPlanMealDto, index: number, gymId: string) {
    return {
      gym_id: gymId,
      meal_type: m.meal_type,
      position: m.position ?? index,
      title: m.title,
      items: (m.items ?? []) as object[],
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      notes: m.notes,
    };
  }
}
