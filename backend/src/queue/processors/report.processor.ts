import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { ReportJobData } from '../queue.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';
import { reportJobFailure } from '../../common/sentry/report-job-failure';

@Processor(QUEUE_NAMES.REPORT)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    reportJobFailure(QUEUE_NAMES.REPORT, job, err);
  }

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<{ url?: string }> {
    const { type, gymId, organizationId, branchId, dateFrom, dateTo, format } = job.data;
    this.logger.log(`Processing report job ${job.id}: type=${type}, format=${format}`);

    // Fail closed. This processor reads member/payment/check-in data, which
    // lives in per-gym schemas; without a gym it would query whatever the base
    // client points at and scope only by branch_id — a cross-tenant read
    // waiting to happen. Nothing enqueues these jobs today, so refusing is
    // strictly safer than guessing.
    if (!gymId) {
      this.logger.error(
        `Report job ${job.id} has no gymId — cannot establish tenant context; dropping`,
      );
      return {};
    }

    try {
      await job.updateProgress(10);

      // Fetch data based on report type, inside that gym's tenant context.
      const data = await this.tasks.runForGym(gymId, () =>
        this.fetchReportData(type, organizationId, branchId, dateFrom, dateTo),
      );
      await job.updateProgress(50);

      // Generate report file (in production, upload to Supabase Storage)
      const reportResult = await this.generateReport(type, data ?? {}, format);
      await job.updateProgress(90);

      // Store report metadata
      this.logger.log(`Report job ${job.id} completed: ${type} (${format})`);
      await job.updateProgress(100);

      return reportResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Report job ${job.id} failed: ${message}`);
      throw error;
    }
  }

  private async fetchReportData(
    type: string,
    organizationId: string,
    branchId: string | undefined,
    dateFrom: string,
    dateTo: string,
  ): Promise<Record<string, unknown>> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const branchFilter = branchId ? { branch_id: branchId } : {};

    switch (type) {
      case 'revenue': {
        const payments = await this.tenant.client.payment.findMany({
          where: { ...branchFilter, paid_at: { gte: from, lte: to } },
          orderBy: { paid_at: 'desc' },
          take: 10000,
        });
        return { type, payments, count: payments.length };
      }
      case 'members': {
        const members = await this.tenant.client.member.findMany({
          where: { ...branchFilter, created_at: { gte: from, lte: to } },
          take: 10000,
        });
        return { type, members, count: members.length };
      }
      case 'attendance': {
        const checkIns = await this.tenant.client.checkIn.findMany({
          where: { ...branchFilter, checked_in_at: { gte: from, lte: to } },
          take: 10000,
        });
        return { type, checkIns, count: checkIns.length };
      }
      default:
        return { type, data: [], count: 0 };
    }
  }

  private async generateReport(
    type: string,
    data: Record<string, unknown>,
    format: string,
  ): Promise<{ url?: string }> {
    // In production, generate actual PDF/CSV/XLSX and upload to Supabase Storage
    // Return signed URL for download
    this.logger.log(`Generated ${format} report for ${type} with ${data.count} records`);
    return { url: undefined }; // Will be populated when Supabase Storage is wired
  }
}
