import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExpenseMetricsService } from './expense-metrics.service';
import {
  EXPENSE_CREATED_EVENT,
  EXPENSE_REVERSED_EVENT,
  type ExpenseEventPayload,
} from './expense-events.service';

/**
 * Listens to expense.created / expense.reversed and incrementally updates the
 * expense_metrics rollup table. Runs in-process (sync) — if this fails, we log
 * and continue. Metrics are always recomputable via ExpenseMetricsService.recompute().
 */
@Injectable()
export class ExpenseMetricsListener {
  private readonly logger = new Logger(ExpenseMetricsListener.name);

  constructor(private readonly metrics: ExpenseMetricsService) {}

  @OnEvent(EXPENSE_CREATED_EVENT, { async: true })
  async onExpenseCreated(payload: ExpenseEventPayload) {
    try {
      await this.metrics.rollup(payload);
    } catch (err) {
      this.logger.error(
        `onExpenseCreated rollup failed for ${payload.expense_id}: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(EXPENSE_REVERSED_EVENT, { async: true })
  async onExpenseReversed(payload: ExpenseEventPayload) {
    try {
      await this.metrics.rollup(payload);
    } catch (err) {
      this.logger.error(
        `onExpenseReversed rollup failed for ${payload.expense_id}: ${(err as Error).message}`,
      );
    }
  }
}
