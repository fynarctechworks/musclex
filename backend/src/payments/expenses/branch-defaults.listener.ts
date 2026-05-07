import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ExpenseCategoriesService } from './expense-categories.service';

export const BRANCH_CREATED_EVENT = 'branch.created';

export interface BranchCreatedPayload {
  gym_id: string;
  branch_id: string;
}

/**
 * When a new branch is created, auto-provision the default expense category set
 * so operators can start logging expenses immediately.
 *
 * Event-driven to avoid a circular module dependency: PaymentsModule listens,
 * BranchesModule only has to emit.
 */
@Injectable()
export class BranchDefaultsListener {
  private readonly logger = new Logger(BranchDefaultsListener.name);

  constructor(private readonly categories: ExpenseCategoriesService) {}

  @OnEvent(BRANCH_CREATED_EVENT, { async: true })
  async onBranchCreated(payload: BranchCreatedPayload) {
    try {
      await this.categories.ensureDefaultsForBranch(payload.branch_id);
      this.logger.log(
        `Provisioned default expense categories for branch=${payload.branch_id}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to provision defaults for branch=${payload.branch_id}: ${(err as Error).message}`,
      );
    }
  }
}
