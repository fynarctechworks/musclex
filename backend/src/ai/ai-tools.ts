import type Anthropic from '@anthropic-ai/sdk';

/**
 * Read-only analytics tools the AI advisor may call.
 *
 * The advisor previously received only the user's role and a client-supplied
 * `view_context` blob — its system prompt literally said "Never fabricate
 * specific numbers", so it could not answer "what was my revenue last month".
 * These tools give it grounded access to the SAME tenant-scoped Prisma client
 * every other service uses, so gym isolation is unchanged.
 *
 * Every tool is a READ. None accept a gym/tenant argument — scope comes from
 * the ambient tenant context, never from the model.
 */
export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_revenue_summary',
    description:
      'Total collected revenue for a date range, split by payment method, plus ' +
      'transaction count. Use for any question about income, sales or collections.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'ISO date, inclusive (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'ISO date, exclusive (YYYY-MM-DD)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_membership_stats',
    description:
      'Current membership counts by status (active, frozen, expired, cancelled), ' +
      'plus how many expire within 7 days and how many have auto-renew on.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_member_counts',
    description:
      'Member counts by lifecycle status and how many joined in the last N days.',
    input_schema: {
      type: 'object',
      properties: {
        joined_within_days: {
          type: 'number',
          description: 'Window for the new-joiner count. Defaults to 30.',
        },
      },
    },
  },
  {
    name: 'get_attendance_summary',
    description:
      'Check-in counts for a date range: total visits, unique members, and the ' +
      'busiest hour of day. Use for footfall, utilisation or peak-time questions.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'ISO date, inclusive' },
        end_date: { type: 'string', description: 'ISO date, exclusive' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_churn_risk',
    description:
      'How many active members sit in each churn-risk bucket (low/medium/high/' +
      'critical) and the average engagement score. Use for retention questions.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_outstanding_dues',
    description:
      'Unpaid and partially-paid invoices: total amount owed, invoice count, and ' +
      'the age of the oldest one. Use for collections / receivables questions.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_revenue_forecast',
    description:
      'Forward-looking revenue projection: this month extrapolated by days ' +
      'elapsed, next month from a trailing average plus trend, plus how many ' +
      'memberships expire next month and their value. Use for "what will we ' +
      'make", "are we on track", or renewal-risk questions. State that this is ' +
      'a run-rate estimate, not a guarantee.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_top_trainers',
    description:
      'Trainers ranked by sessions delivered in a period, with members trained ' +
      'and revenue generated. Use for staff-performance questions.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many to return. Defaults to 5.' },
      },
    },
  },
];

export const AI_TOOL_NAMES = new Set(AI_TOOLS.map((t) => t.name));
