import * as Sentry from '@sentry/nestjs';
import type { Job } from 'bullmq';

/**
 * Capture a failed BullMQ job to Sentry with queue/job tags.
 * No-op when SENTRY_DSN is not set.
 */
export function reportJobFailure(queueName: string, job: Job | undefined, err: Error): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setTags({
      queue: queueName,
      job_name: job?.name || 'unknown',
      job_id: job?.id ? String(job.id) : 'unknown',
      attempts: String(job?.attemptsMade ?? 0),
    });
    if (job?.data && typeof job.data === 'object') {
      // gym/org id is the only tag-worthy field; never log raw job data.
      const data = job.data as Record<string, unknown>;
      const gymId = (data.organizationId || data.gymId || data.gym_id) as string | undefined;
      if (gymId) scope.setTag('gym_id', gymId);
    }
    Sentry.captureException(err);
  });
}
