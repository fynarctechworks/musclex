import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { CurrentMemberContext } from '../decorators/current-member.decorator';
import { MemberException } from '../common/member-exception';

const COACH_SYSTEM_PROMPT = `You are the MuscleX AI Coach — a friendly, motivating fitness and nutrition coach inside a gym's member app. You help gym members train smarter, eat better, and stay consistent.

Guidelines:
- Be warm, encouraging and concise (2-6 short paragraphs max; use bullet lists for steps).
- Ground advice in the member context you are given (goals, experience, prescribed plans, recent activity). Refer to their plan by name when relevant.
- Never give medical diagnoses or prescribe medication. For pain, injuries or medical conditions, advise seeing a professional.
- Never fabricate the member's data — if something isn't in the context, ask.
- If asked about things outside fitness/nutrition/wellness/motivation, politely steer back.
- Prefer actionable, specific answers (sets/reps ranges, food swaps, habit tips) over generic advice.`;

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface CoachChatResult {
  conversation_id: string;
  response: string;
  messages: ChatMessage[];
}

/**
 * Member-facing AI coach (the member-app counterpart of the staff AiService).
 * Conversation history lives in member_ai_conversations, one rolling
 * conversation per member (created on first message). Context (profile, plans,
 * recent training) is rebuilt server-side per message — the client sends only
 * text, never data about itself.
 */
@Injectable()
export class MemberCoachService {
  private readonly logger = new Logger(MemberCoachService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) this.anthropic = new Anthropic({ apiKey });
    else this.logger.warn('ANTHROPIC_API_KEY not set — member coach will use fallback responses');
  }

  async chat(member: CurrentMemberContext, message: string): Promise<CoachChatResult> {
    if (!member.memberId) {
      throw MemberException.notAMember();
    }

    // One rolling conversation per member.
    let conversation = await this.tenant.client.memberAiConversation.findFirst({
      where: { member_id: member.memberId },
      orderBy: { created_at: 'desc' },
    });
    if (!conversation) {
      conversation = await this.tenant.client.memberAiConversation.create({
        data: { gym_id: member.tenantId!, member_id: member.memberId, messages: [] },
      });
    }

    const history = ((conversation.messages as unknown as ChatMessage[]) ?? []).slice(-40);
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    let responseText: string;
    try {
      responseText = await this.generateResponse(member, message, history);
    } catch (e) {
      this.logger.error(`Coach response failed: ${(e as Error).message}`);
      responseText = this.fallbackResponse();
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    };
    const updated = [...history, userMessage, assistantMessage].slice(-60);

    await this.tenant.client.memberAiConversation.update({
      where: { id: conversation.id },
      data: { messages: updated as unknown as object[] },
    });

    return { conversation_id: conversation.id, response: responseText, messages: updated };
  }

  async getConversation(member: CurrentMemberContext): Promise<{ conversation_id: string | null; messages: ChatMessage[] }> {
    if (!member.memberId) return { conversation_id: null, messages: [] };
    const conversation = await this.tenant.client.memberAiConversation.findFirst({
      where: { member_id: member.memberId },
      orderBy: { created_at: 'desc' },
    });
    return {
      conversation_id: conversation?.id ?? null,
      messages: ((conversation?.messages as unknown as ChatMessage[]) ?? []).slice(-60),
    };
  }

  // ────────────────────────────────────────────────────────────────

  private async generateResponse(
    member: CurrentMemberContext,
    message: string,
    history: ChatMessage[],
  ): Promise<string> {
    if (!this.anthropic) return this.fallbackResponse();

    const context = await this.buildMemberContext(member.memberId!);
    const claudeMessages = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    claudeMessages.push({ role: 'user', content: message });

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `${COACH_SYSTEM_PROMPT}\n\nMember context (server-verified):\n${context}`,
      messages: claudeMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock && 'text' in textBlock
      ? textBlock.text
      : 'I could not generate a response — please try again.';
  }

  /** Compact, server-sourced snapshot of the member for the system prompt. */
  private async buildMemberContext(memberId: string): Promise<string> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [memberRow, dietAssignment, upcomingWorkout, recentLogs, nutritionGoal] = await Promise.all([
      this.tenant.client.member.findFirst({
        where: { id: memberId },
        select: { full_name: true, gender: true, profile: true },
      }),
      this.tenant.client.assignedDietPlan.findFirst({
        where: { member_id: memberId, status: 'active' },
        include: { diet_plan: { select: { title: true, goal: true, daily_calories: true } } },
      }),
      this.tenant.client.assignedWorkout.findFirst({
        where: { member_id: memberId, status: 'assigned' },
        orderBy: { scheduled_date: 'asc' },
        include: { workout_plan: { select: { title: true, goal: true, difficulty: true } } },
      }),
      this.tenant.client.workoutLog.count({
        where: { member_id: memberId, logged_at: { gte: sevenDaysAgo } },
      }),
      this.tenant.client.nutritionGoal.findFirst({ where: { member_id: memberId } }),
    ]);

    const p = memberRow?.profile as
      | {
          fitness_goal?: string | null;
          goals?: string[];
          activity_level?: string | null;
          training_experience?: string | null;
          height?: unknown;
          weight?: unknown;
          medical_conditions?: string[];
        }
      | null
      | undefined;

    const lines: string[] = [];
    if (memberRow?.full_name) lines.push(`Name: ${memberRow.full_name}`);
    if (memberRow?.gender) lines.push(`Gender: ${memberRow.gender}`);
    if (p?.fitness_goal) lines.push(`Primary goal: ${p.fitness_goal}`);
    if (p?.goals?.length) lines.push(`Goals: ${p.goals.join(', ')}`);
    if (p?.activity_level) lines.push(`Activity level: ${p.activity_level}`);
    if (p?.training_experience) lines.push(`Experience: ${p.training_experience}`);
    if (p?.height) lines.push(`Height: ${p.height} cm`);
    if (p?.weight) lines.push(`Weight: ${p.weight} kg`);
    if (p?.medical_conditions?.length) lines.push(`Notes/conditions: ${p.medical_conditions.join(', ')}`);
    if (dietAssignment) {
      lines.push(
        `Prescribed diet plan: "${dietAssignment.diet_plan.title}" (goal ${dietAssignment.diet_plan.goal ?? 'n/a'}, ~${dietAssignment.diet_plan.daily_calories ?? '?'} kcal/day)`,
      );
    }
    if (upcomingWorkout) {
      lines.push(
        `Next assigned workout: "${upcomingWorkout.workout_plan.title}" (${upcomingWorkout.workout_plan.difficulty ?? 'n/a'}) on ${upcomingWorkout.scheduled_date.toISOString().slice(0, 10)}`,
      );
    }
    lines.push(`Workouts logged in the last 7 days: ${recentLogs}`);
    if (nutritionGoal) {
      lines.push(`Nutrition goal: ${JSON.stringify({ calories: (nutritionGoal as any).calories ?? undefined })}`);
    }
    return lines.join('\n') || 'No profile data available yet.';
  }

  private fallbackResponse(): string {
    return (
      'I’m having trouble reaching the coaching engine right now. ' +
      'Meanwhile: stay consistent — hit your scheduled workout, drink water, and prioritize protein in your next meal. ' +
      'Try me again in a few minutes!'
    );
  }
}
