import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { AssignWorkoutPlanDto, CreateWorkoutPlanDto, UpdateWorkoutPlanDto } from './dto';

/**
 * Staff-side workout plan CRUD + assignment. The models (WorkoutPlan,
 * WorkoutPlanExercise, AssignedWorkout) existed since the member-app workout
 * domain shipped, but only the member BFF could READ them — there was no way
 * for a trainer to create or assign a plan. This closes that gap.
 */
@Injectable()
export class WorkoutPlansService {
  constructor(private readonly tenant: TenantPrisma) {}

  async findAll(filters: { search?: string; is_template?: string; is_active?: string; page?: number; limit?: number }) {
    const { search, is_template, is_active, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (is_template !== undefined) where.is_template = is_template === 'true';
    if (is_active !== undefined) where.is_active = is_active === 'true';

    const [data, total] = await Promise.all([
      this.tenant.client.workoutPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          created_by: { select: { id: true, full_name: true } },
          _count: { select: { exercises: true, assigned_workouts: true } },
        },
      }),
      this.tenant.client.workoutPlan.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const plan = await this.tenant.client.workoutPlan.findUnique({
      where: { id },
      include: {
        created_by: { select: { id: true, full_name: true } },
        exercises: {
          orderBy: { position: 'asc' },
          include: { exercise: { select: { id: true, name: true, muscle_group: true, equipment: true } } },
        },
      },
    });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return plan;
  }

  async create(dto: CreateWorkoutPlanDto, staffId: string | null) {
    const gymId = getTenantGymId()!;
    return this.tenant.client.workoutPlan.create({
      data: {
        gym_id: gymId,
        title: dto.title,
        description: dto.description,
        goal: dto.goal,
        difficulty: dto.difficulty,
        is_template: dto.is_template ?? true,
        created_by_staff_id: staffId,
        exercises: dto.exercises?.length
          ? {
              create: dto.exercises.map((e, i) => ({
                gym_id: gymId,
                exercise_id: e.exercise_id,
                position: e.position ?? i,
                target_sets: e.target_sets ?? 3,
                target_reps: e.target_reps ?? 10,
                target_weight: e.target_weight,
                rest_seconds: e.rest_seconds ?? 60,
                notes: e.notes,
              })),
            }
          : undefined,
      },
      include: { exercises: { orderBy: { position: 'asc' } } },
    });
  }

  async update(id: string, dto: UpdateWorkoutPlanDto) {
    await this.findOne(id);
    const gymId = getTenantGymId()!;
    const { exercises, ...fields } = dto;

    return this.tenant.client.$transaction(async (tx) => {
      if (exercises) {
        await tx.workoutPlanExercise.deleteMany({ where: { workout_plan_id: id } });
        if (exercises.length) {
          await tx.workoutPlanExercise.createMany({
            data: exercises.map((e, i) => ({
              gym_id: gymId,
              workout_plan_id: id,
              exercise_id: e.exercise_id,
              position: e.position ?? i,
              target_sets: e.target_sets ?? 3,
              target_reps: e.target_reps ?? 10,
              target_weight: e.target_weight,
              rest_seconds: e.rest_seconds ?? 60,
              notes: e.notes,
            })),
          });
        }
      }
      return tx.workoutPlan.update({
        where: { id },
        data: fields,
        include: { exercises: { orderBy: { position: 'asc' } } },
      });
    });
  }

  /** Soft delete — assigned history must survive. */
  async remove(id: string) {
    await this.findOne(id);
    await this.tenant.client.workoutPlan.update({ where: { id }, data: { is_active: false } });
    return { success: true };
  }

  async assign(planId: string, dto: AssignWorkoutPlanDto, staffId: string | null) {
    const plan = await this.findOne(planId);
    if (!plan.is_active) throw new BadRequestException('Cannot assign an inactive plan');
    if (!dto.dates.length) throw new BadRequestException('At least one date is required');
    if (dto.dates.length > 90) throw new BadRequestException('At most 90 dates per assignment');

    const member = await this.tenant.client.member.findFirst({
      where: { id: dto.member_id },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const gymId = getTenantGymId()!;
    const dates = [...new Set(dto.dates)].map((d) => new Date(d));

    // Idempotent: skip dates this member already has this plan scheduled for.
    const existing = await this.tenant.client.assignedWorkout.findMany({
      where: {
        member_id: dto.member_id,
        workout_plan_id: planId,
        scheduled_date: { in: dates },
      },
      select: { scheduled_date: true },
    });
    const taken = new Set(existing.map((e) => e.scheduled_date.toISOString().slice(0, 10)));
    const fresh = dates.filter((d) => !taken.has(d.toISOString().slice(0, 10)));

    if (fresh.length) {
      await this.tenant.client.assignedWorkout.createMany({
        data: fresh.map((scheduled_date) => ({
          gym_id: gymId,
          member_id: dto.member_id,
          workout_plan_id: planId,
          assigned_by_staff_id: staffId,
          scheduled_date,
        })),
      });
    }
    return { assigned: fresh.length, skipped_existing: dates.length - fresh.length };
  }

  async assignments(filters: { member_id?: string; status?: string; page?: number; limit?: number }) {
    const { member_id, status, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (member_id) where.member_id = member_id;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.tenant.client.assignedWorkout.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduled_date: 'desc' },
        include: {
          workout_plan: { select: { id: true, title: true, goal: true, difficulty: true } },
          member: { select: { id: true, full_name: true, member_code: true } },
        },
      }),
      this.tenant.client.assignedWorkout.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async cancelAssignment(assignmentId: string) {
    const assignment = await this.tenant.client.assignedWorkout.findFirst({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed workout');
    }
    await this.tenant.client.assignedWorkout.update({
      where: { id: assignmentId },
      data: { status: 'skipped' },
    });
    return { success: true };
  }
}
