import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Send a chat message to AI advisor.
   * For now, returns a mock response since Anthropic API key is required.
   * Stores the conversation in ai_conversations table.
   */
  async chat(data: {
    message: string;
    conversation_id?: string;
    staff_id: string;
  }) {
    let conversationId = data.conversation_id;

    // Create new conversation if none provided
    if (!conversationId) {
      const conversation = await this.prisma.aiConversation.create({
        data: {
          id: randomUUID(),
          staff_id: data.staff_id,
          messages: [],
        },
      });
      conversationId = conversation.id;
    }

    // Fetch existing conversation
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Build messages array
    const existingMessages = (conversation.messages as any[]) || [];
    const userMessage = {
      role: 'user',
      content: data.message,
      timestamp: new Date().toISOString(),
    };

    // Mock AI response — replace with Anthropic SDK call when API key is configured
    const aiResponseContent = this.generateMockResponse(data.message);
    const assistantMessage = {
      role: 'assistant',
      content: aiResponseContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...existingMessages, userMessage, assistantMessage];

    // Update conversation with new messages
    await this.prisma.aiConversation.update({
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
   * Get daily briefing data.
   * Returns mock briefing — will be replaced with real analytics + Claude summary.
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
          this.prisma.member.count(),
          this.prisma.checkIn.count({
            where: { checked_in_at: { gte: today } },
          }),
          this.prisma.member.count({ where: { status: 'active' } }),
          this.prisma.memberMembership.count({
            where: {
              status: 'active',
              end_date: { gte: today, lt: weekFromNow },
            },
          }),
          this.prisma.payment.count({
            where: { status: 'pending' },
          }),
        ]);

      const revResult = await this.prisma.payment.aggregate({
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

    return {
      date: today.toISOString().slice(0, 10),
      summary: `Good morning! Here's your daily briefing for ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`,
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
        {
          type: 'info',
          title: 'Peak Hours Today',
          message: 'Expected peak between 6-8 PM based on historical data.',
        },
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
   * List conversations for a staff member.
   */
  async getConversations(staffId: string) {
    const conversations = await this.prisma.aiConversation.findMany({
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
   * Generate a contextual mock response based on the user's message.
   * This will be replaced with actual Anthropic Claude API calls.
   */
  private generateMockResponse(message: string): string {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('revenue') || lowerMsg.includes('income')) {
      return 'Based on current data, your monthly revenue is trending 8% higher than last month. The biggest contributors are new membership sign-ups (45%) and plan renewals (35%). I recommend focusing on retention campaigns for members whose plans expire in the next 30 days to maintain this growth trajectory.';
    }

    if (lowerMsg.includes('member') && (lowerMsg.includes('churn') || lowerMsg.includes('retention'))) {
      return 'Your current churn rate is approximately 12%. I\'ve identified 15 members at high risk of churning based on declining visit frequency. Sending personalized check-in messages and offering a complimentary personal training session could help retain these members.';
    }

    if (lowerMsg.includes('class') || lowerMsg.includes('schedule')) {
      return 'Your most popular classes this week are Yoga (92% occupancy), HIIT (88%), and Spin (85%). I notice the 7 AM Yoga slot is consistently full — consider adding a second morning session. The Tuesday 3 PM Pilates class has low attendance (35%); you might want to reschedule it to a peak hour.';
    }

    if (lowerMsg.includes('staff') || lowerMsg.includes('trainer')) {
      return 'Your top-performing trainer this month is Sarah with a 95% attendance rate and 4.8/5 member rating. Two trainers have upcoming certification renewals in the next 30 days. I recommend scheduling their recertification sessions soon to avoid any gaps in service.';
    }

    return 'I\'m your AI gym advisor. I can help you analyze revenue trends, member retention, class scheduling, staff performance, and more. What would you like to know about your gym operations? (Note: This is a mock response — connect your Anthropic API key for real AI-powered insights.)';
  }
}
