import { Injectable } from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

export interface MemberPlansData {
  diet_plan: null | {
    assignment_id: string;
    starts_on: string;
    ends_on: string | null;
    notes: string | null;
    assigned_by: string | null;
    plan: {
      id: string;
      title: string;
      description: string | null;
      goal: string | null;
      daily_calories: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      meals: Array<{
        id: string;
        meal_type: string;
        position: number;
        title: string;
        items: unknown;
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        notes: string | null;
      }>;
    };
  };
  upcoming_workouts: Array<{
    assignment_id: string;
    scheduled_date: string;
    status: string;
    plan: {
      id: string;
      title: string;
      goal: string | null;
      difficulty: string | null;
      exercise_count: number;
    };
  }>;
}

/**
 * The member's prescribed plans: the active trainer-assigned diet plan (with
 * full meals) and the next 7 days of assigned workouts. Read-only; every query
 * is pinned to the member from the verified token.
 */
@Injectable()
export class MemberPlanService {
  constructor(private readonly tenant: TenantPrisma) {}

  async getMyPlans(member: CurrentMemberContext): Promise<MemberPlansData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);

    const [dietAssignment, workouts] = await Promise.all([
      this.tenant.client.assignedDietPlan.findFirst({
        where: { member_id: member.memberId!, status: 'active' },
        orderBy: { created_at: 'desc' },
        include: {
          diet_plan: { include: { meals: { orderBy: [{ position: 'asc' }, { created_at: 'asc' }] } } },
          assigned_by: { select: { full_name: true } },
        },
      }),
      this.tenant.client.assignedWorkout.findMany({
        where: {
          member_id: member.memberId!,
          scheduled_date: { gte: today, lt: weekOut },
          status: { in: ['assigned', 'completed'] },
        },
        orderBy: { scheduled_date: 'asc' },
        include: {
          workout_plan: {
            select: {
              id: true,
              title: true,
              goal: true,
              difficulty: true,
              _count: { select: { exercises: true } },
            },
          },
        },
      }),
    ]);

    return {
      diet_plan: dietAssignment
        ? {
            assignment_id: dietAssignment.id,
            starts_on: dietAssignment.starts_on.toISOString().slice(0, 10),
            ends_on: dietAssignment.ends_on ? dietAssignment.ends_on.toISOString().slice(0, 10) : null,
            notes: dietAssignment.notes,
            assigned_by: dietAssignment.assigned_by?.full_name ?? null,
            plan: {
              id: dietAssignment.diet_plan.id,
              title: dietAssignment.diet_plan.title,
              description: dietAssignment.diet_plan.description,
              goal: dietAssignment.diet_plan.goal,
              daily_calories: dietAssignment.diet_plan.daily_calories,
              protein_g: dietAssignment.diet_plan.protein_g,
              carbs_g: dietAssignment.diet_plan.carbs_g,
              fat_g: dietAssignment.diet_plan.fat_g,
              meals: dietAssignment.diet_plan.meals.map((m) => ({
                id: m.id,
                meal_type: m.meal_type,
                position: m.position,
                title: m.title,
                items: m.items,
                calories: m.calories,
                protein_g: m.protein_g,
                carbs_g: m.carbs_g,
                fat_g: m.fat_g,
                notes: m.notes,
              })),
            },
          }
        : null,
      upcoming_workouts: workouts.map((w) => ({
        assignment_id: w.id,
        scheduled_date: w.scheduled_date.toISOString().slice(0, 10),
        status: w.status,
        plan: {
          id: w.workout_plan.id,
          title: w.workout_plan.title,
          goal: w.workout_plan.goal,
          difficulty: w.workout_plan.difficulty,
          exercise_count: w.workout_plan._count.exercises,
        },
      })),
    };
  }
}
