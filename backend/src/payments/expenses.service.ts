import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ExpenseEventsService } from './expenses/expense-events.service';
import type {
  CreateExpenseDto,
  ExpenseFiltersDto,
} from './expenses/dto';

/**
 * Back-compat façade for the historical basic CRUD API.
 *
 * The canonical implementation lives in `ExpenseEventsService` (append-only,
 * event-sourced, financial-ledger-aware). This shim exists solely so any legacy
 * imports of `ExpensesService` keep working. New code should depend on
 * `ExpenseEventsService` directly.
 *
 * Note: `update` and `remove` are deliberately not supported anymore —
 * expenses are now immutable and must be reversed via `reverseExpense`.
 */
export type ExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'equipment'
  | 'utilities'
  | 'marketing'
  | 'maintenance'
  | 'other';

@Injectable()
export class ExpensesService {
  constructor(private readonly events: ExpenseEventsService) {}

  create(
    data: CreateExpenseDto & { recorded_by_staff_id: string },
  ) {
    return this.events.createExpense(data, { staff_id: data.recorded_by_staff_id });
  }

  findAll(query: ExpenseFiltersDto) {
    return this.events.findAll(query);
  }

  update(): never {
    throw new HttpException(
      {
        statusCode: 410,
        message:
          'Expenses are immutable. Use ExpenseEventsService.reverseExpense() to reverse + record a corrected entry.',
        code: 'EXPENSE_IMMUTABLE',
      },
      HttpStatus.GONE,
    );
  }

  remove(): never {
    throw new HttpException(
      {
        statusCode: 410,
        message:
          'Expenses are immutable. Use ExpenseEventsService.reverseExpense() instead.',
        code: 'EXPENSE_IMMUTABLE',
      },
      HttpStatus.GONE,
    );
  }
}
