import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { ReportJobData } from '../queue.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor(QUEUE_NAMES.REPORT)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<{ url?: string }> {
    const { type, organizationId, branchId, dateFrom, dateTo, format, requestedBy } = job.data;
    this.logger.log(`Processing report job ${job.id}: type=${type}, format=${format}`);

    try {
      await job.updateProgress(10);

      // Fetch data based on report type
      const data = await this.fetchReportData(type, organizationId, branchId, dateFrom, dateTo);
      await job.updateProgress(50);

      // Generate report file (in production, upload to Supabase Storage)
      const reportResult = await this.generateReport(type, data, format);
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
        const payments = await this.prisma.payment.findMany({
          where: { ...branchFilter, paid_at: { gte: from, lte: to } },
          orderBy: { paid_at: 'desc' },
          take: 10000,
        });
        return { type, payments, count: payments.length };
      }
      case 'members': {
        const members = await this.prisma.member.findMany({
          where: { ...branchFilter, created_at: { gte: from, lte: to } },
          take: 10000,
        });
        return { type, members, count: members.length };
      }
      case 'attendance': {
        const checkIns = await this.prisma.checkIn.findMany({
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
