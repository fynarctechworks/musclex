import { Injectable } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberRoutineService } from './member-routine.service';

/**
 * ────────────────────────────────────────────────────────────────
 * EXPLORE
 * ────────────────────────────────────────────────────────────────
 *
 * A central, MuscleX-curated workout library. Every member at every gym sees
 * the same set, so it lives in `public` — copying it per tenant would mean N
 * places to update and gyms silently drifting from the canonical content.
 *
 * Adding one produces a personal ROUTINE in the member's own gym, resolved by
 * exercise name through the same matcher shared-routine import uses. Explore is
 * therefore not a parallel system: it is a source of routines.
 */
@Injectable()
export class MemberExploreService {
  constructor(
    private readonly pub: PublicPrismaService,
    private readonly routines: MemberRoutineService,
  ) {}

  /** Published workouts grouped by category, in curated order. */
  async browse() {
    const rows = await this.pub.exploreWorkout.findMany({
      where: { is_published: true },
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    });

    const byCategory = new Map<string, ReturnType<typeof this.toCard>[]>();
    for (const r of rows) {
      const list = byCategory.get(r.category) ?? [];
      list.push(this.toCard(r));
      byCategory.set(r.category, list);
    }

    return {
      categories: [...byCategory.entries()].map(([category, workouts]) => ({
        category,
        label: this.categoryLabel(category),
        workouts,
      })),
    };
  }

  async detail(slug: string) {
    const row = await this.pub.exploreWorkout.findFirst({
      where: { slug, is_published: true },
    });
    if (!row) throw MemberException.notFound('That workout is not available.');
    const exercises = row.exercises as {
      name: string;
      targetSets?: number;
      targetReps?: number;
      targetDurationSeconds?: number;
    }[];
    return { ...this.toCard(row), description: row.description, exercises };
  }

  /**
   * Add an Explore workout to the member's own routines.
   *
   * Reports which exercises their gym does not stock rather than dropping them
   * quietly — a curated workout arriving with half its movements missing and no
   * explanation looks like a broken app, not a catalogue gap.
   */
  async addToRoutines(member: CurrentMemberContext, slug: string) {
    const workout = await this.detail(slug);
    const { matched, missing } = await this.routines.resolveByName(member, workout.exercises);

    if (!matched.length) {
      throw MemberException.badRequest(
        'Your gym does not stock any of these exercises, so this workout cannot be added.',
      );
    }

    const routine = await this.routines.create(member, {
      name: workout.title,
      notes: workout.description ?? undefined,
      exercises: matched,
    });

    await this.pub.exploreWorkout.update({
      where: { slug },
      data: { add_count: { increment: 1 } },
    });

    return { routine, missing };
  }

  private toCard(r: {
    slug: string;
    title: string;
    description: string | null;
    category: string;
    difficulty: string;
    duration_minutes: number | null;
    exercises: unknown;
    add_count: number;
  }) {
    return {
      slug: r.slug,
      title: r.title,
      category: r.category,
      difficulty: r.difficulty,
      durationMinutes: r.duration_minutes,
      exerciseCount: Array.isArray(r.exercises) ? r.exercises.length : 0,
      addCount: r.add_count,
    };
  }

  /** Category keys are stored, labels are presentation — kept out of the data. */
  private categoryLabel(key: string): string {
    const LABELS: Record<string, string> = {
      full_body: 'Full body',
      push: 'Push',
      pull: 'Pull',
      legs: 'Legs',
      core: 'Core',
      bodyweight: 'No equipment',
      conditioning: 'Conditioning',
    };
    return LABELS[key] ?? key.replace(/_/g, ' ');
  }
}
