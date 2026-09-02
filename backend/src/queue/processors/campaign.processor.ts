import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { CampaignJobData } from '../queue.service';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';
import { CampaignSenderService } from '../../marketing/campaign-sender.service';
import { reportJobFailure } from '../../common/sentry/report-job-failure';

/**
 * Executes a queued campaign inside the owning gym's tenant context. All the
 * real work (audience load, render, per-channel delivery, status bookkeeping)
 * lives in CampaignSenderService so the Redis-less inline path behaves
 * identically.
 */
@Processor(QUEUE_NAMES.CAMPAIGN)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    // ALWAYS log: reportJobFailure() is a no-op without SENTRY_DSN, so a
    // failing job would otherwise leave no trace anywhere.
    this.logger.error(
      `Job ${job?.id ?? '?'} FAILED (attempt ${job?.attemptsMade ?? 0}/${job?.opts?.attempts ?? 1}): ${err?.message}`,
    );
    reportJobFailure(QUEUE_NAMES.CAMPAIGN, job, err);
  }

  constructor(
    private readonly tasks: TenantTaskRunner,
    private readonly sender: CampaignSenderService,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<{ sent: number; failed: number; skipped: number }> {
    const { campaignId, gymId } = job.data;
    if (!gymId) {
      this.logger.error(`Campaign job ${job.id} has no gymId — cannot establish tenant context; dropping`);
      return { sent: 0, failed: 0, skipped: 0 };
    }
    this.logger.log(`Processing campaign job ${job.id}: campaign=${campaignId}, gym=${gymId}`);
    const result = await this.tasks.runForGym(gymId, () => this.sender.dispatch(campaignId));
    return result ?? { sent: 0, failed: 0, skipped: 0 };
  }
}
