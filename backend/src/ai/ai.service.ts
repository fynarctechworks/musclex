import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getTenantGymId } from '../common/tenant-context';

const SYSTEM_PROMPT = `You are MuscleX AI Advisor — an expert gym management consultant embedded in a fitness studio SaaS platform. Your role is to help gym owners and managers optimize operations, increase revenue, improve member retention, and manage staff effectively.

Guidelines:
- Be concise, actionable, and data-driven in your responses.
- When discussing metrics, reference industry benchmarks for fitness studios.
- Suggest specific, implementable actions — not generic advice.
- Format responses with clear structure (bullet points, sections) when appropriate.
- If you don't have enough context, ask clarifying questions.
- Never fabricate specific numbers — only provide ranges or benchmarks.
- Focus on: revenue growth, member retention, class optimization, staff performance, and operational efficiency.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private readonly tenant: TenantPrisma,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic AI client initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI advisor will use fallback responses');
    }
  }

  /**
   * Send a chat message to AI advisor.
   * Uses Claude API when configured, falls back to contextual mock responses.
   */
  async chat(data: {
    message: string;
    conversation_id?: string;
    staff_id: string;
    view_context?: Record<string, unknown>;
    user_role?: string;
  }) {
    let conversationId = data.conversation_id;

    // Create new conversation if none provided
    if (!conversationId) {
      const conversation = await this.tenant.client.aiConversation.create({
        data: {
          id: randomUUID(),
          gym_id: getTenantGymId()!,
          staff_id: data.staff_id,
          messages: [],
        },
      });
      conversationId = conversation.id;
    }

    // Fetch existing conversation
    const conversation = await this.tenant.client.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Build messages array
    const existingMessages = (conversation.messages as { role: string; content: string; timestamp: string }[]) || [];
    const userMessage = {
      role: 'user',
      content: data.message,
      timestamp: new Date().toISOString(),
    };

    // Generate AI response with view context (Wave 5: scope-aware advisor)
    let aiResponseContent: string;
    try {
      aiResponseContent = await this.generateResponse(
        data.message,
        existingMessages,
        data.view_context,
        data.user_role,
      );
    } catch (err) {
      this.logger.error(`AI response failed: ${err instanceof Error ? err.message : err}`);
      aiResponseContent = this.generateFallbackResponse(data.message);
    }

    const assistantMessage = {
      role: 'assistant',
      content: aiResponseContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    // Update conversation with new messages
    await this.tenant.client.aiConversation.update({
      where: { id: conversationId },
      data: {
        messages: updatedMessages,
        updated_at: new Date(),
      },
    });

    return {
      conversation_id: conversationId,
      response: aiResponseContent,
      messages: updatedMessages,
    };
  }

  /**
   * Generate AI response using Anthropic Claude, with fallback.
   * Wave 5: injects view context (active branch, role, screen, period) so
   * the advisor answers in the user's current scope without asking.
   */
  private async generateResponse(
    message: string,
    history: { role: string; content: string }[],
    viewContext?: Record<string, unknown>,
    userRole?: string,
  ): Promise<string> {
    if (!this.anthropic) {
      return this.generateFallbackResponse(message);
    }

    const recentHistory = history.slice(-20);
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] =
      recentHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

    claudeMessages.push({ role: 'user', content: message });

    const ctxParts: string[] = [];
    if (userRole) ctxParts.push(`The asker's role is "${userRole}".`);
    if (viewContext && Object.keys(viewContext).length > 0) {
      ctxParts.push(
        `They are currently viewing: ${JSON.stringify(viewContext)}.`,
      );
      ctxParts.push(
        'Answer in that scope. Do not ask "which branch / role / period" — assume the one in view_context unless they explicitly broaden.',
      );
    }
    const systemPrompt =
      ctxParts.length > 0
        ? `${SYSTEM_PROMPT}\n\n${ctxParts.join(' ')}`
        : SYSTEM_PROMPT;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text : 'I was unable to generate a response. Please try again.';
  }

  /**
   * Get daily briefing data with real metrics.
   */
  async getDailyBriefing() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    let totalMembers = 0;
    let todayCheckIns = 0;
    let activeMembers = 0;
    let expiringThisWeek = 0;
    let revenueToday = 0;
    let pendingPayments = 0;

    try {
      [totalMembers, todayCheckIns, activeMembers, expiringThisWeek, pendingPayments] =
        await Promise.all([
          this.tenant.client.member.count(),
          this.tenant.client.checkIn.count({
            where: { checked_in_at: { gte: today } },
          }),
          this.tenant.client.member.count({ where: { status: 'active' } }),
          this.tenant.client.memberMembership.count({
            where: {
              status: 'active',
              end_date: { gte: today, lt: weekFromNow },
            },
          }),
          this.tenant.client.payment.count({
            where: { status: 'pending' },
          }),
        ]);

      const revResult = await this.tenant.client.payment.aggregate({
        where: {
          paid_at: { gte: today },
          status: 'paid',
        },
        _sum: { amount: true },
      });
      revenueToday = Number(revResult._sum?.amount ?? 0);
    } catch (error) {
      this.logger.warn('Failed to fetch briefing metrics', error instanceof Error ? error.message : error);
    }

    // Build AI-powered summary if available
    let summary: string;
    try {
      summary = await this.generateBriefingSummary({
        totalMembers,
        activeMembers,
        todayCheckIns,
        expiringThisWeek,
        revenueToday,
        pendingPayments,
      });
    } catch {
      summary = `Good morning! Here's your daily briefing for ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
    }

    return {
      date: today.toISOString().slice(0, 10),
      summary,
      metrics: {
        total_members: totalMembers,
        active_members: activeMembers,
        today_check_ins: todayCheckIns,
        expiring_this_week: expiringThisWeek,
        revenue_today: revenueToday,
        pending_payments: pendingPayments,
      },
      alerts: [
        ...(expiringThisWeek > 0
          ? [{
              type: 'warning',
              title: 'Memberships Expiring',
              message: `${expiringThisWeek} memberships are expiring this week. Consider sending renewal reminders.`,
            }]
          : []),
        ...(pendingPayments > 0
          ? [{
              type: 'warning',
              title: 'Pending Payments',
              message: `${pendingPayments} payments are still pending. Follow up to ensure timely collection.`,
            }]
          : []),
      ],
      recommendations: [
        ...(expiringThisWeek > 0
          ? ['Send renewal reminders to members expiring this week']
          : []),
        ...(pendingPayments > 0
          ? [`Follow up on ${pendingPayments} pending payments`]
          : []),
      ],
    };
  }

  /**
   * Generate a briefing summary using Claude if available.
   */
  private async generateBriefingSummary(metrics: {
    totalMembers: number;
    activeMembers: number;
    todayCheckIns: number;
    expiringThisWeek: number;
    revenueToday: number;
    pendingPayments: number;
  }): Promise<string> {
    if (!this.anthropic) {
      const today = new Date();
      return `Good morning! Here's your daily briefing for ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'You are a gym management AI. Generate a brief, friendly daily briefing summary (2-3 sentences) based on the metrics provided. Be specific and actionable.',
      messages: [{
        role: 'user',
        content: `Today's metrics: ${metrics.totalMembers} total members, ${metrics.activeMembers} active, ${metrics.todayCheckIns} check-ins so far today, ${metrics.expiringThisWeek} memberships expiring this week, revenue today: ₹${metrics.revenueToday}, ${metrics.pendingPayments} pending payments. Generate a concise morning briefing.`,
      }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text || `Good morning! You have ${metrics.activeMembers} active members and ${metrics.todayCheckIns} check-ins today.`;
  }

  /**
   * List conversations for a staff member.
   */
  async getConversations(staffId: string) {
    const conversations = await this.tenant.client.aiConversation.findMany({
      where: { staff_id: staffId },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return { data: conversations };
  }

  /**
   * Generate a contextual fallback response when Claude API is unavailable.
   */
  private generateFallbackResponse(message: string): string {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('revenue') || lowerMsg.includes('income')) {
      return 'I can help analyze your revenue trends once connected. To get real-time AI insights, ensure your ANTHROPIC_API_KEY environment variable is configured. In the meantime, check your Finance dashboard for revenue charts and trends.';
    }

    if (lowerMsg.includes('member') && (lowerMsg.includes('churn') || lowerMsg.includes('retention'))) {
      return 'Member retention analysis requires AI to be fully connected. Check your Members > Churn Risk page for members at risk of leaving. Common retention strategies include: personalized check-in messages, offering complimentary sessions, and renewal reminder campaigns.';
    }

    if (lowerMsg.includes('class') || lowerMsg.includes('schedule')) {
      return 'For class optimization insights, please configure your ANTHROPIC_API_KEY. Meanwhile, review your Classes page for occupancy rates and consider adjusting low-attendance classes to peak hours.';
    }

    if (lowerMsg.includes('staff') || lowerMsg.includes('trainer')) {
      return 'Staff performance analysis is available when AI is fully connected. Check your Staff > Analytics page for attendance rates and trainer ratings. Consider scheduling regular performance reviews.';
    }

    return 'I\'m your AI gym advisor. To unlock full AI-powered insights (revenue analysis, churn prediction, class optimization), please configure the ANTHROPIC_API_KEY environment variable. Meanwhile, I can help with general gym management questions.';
  }
}
