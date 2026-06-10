import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PaginatedResult, PaginationDto } from '../../../common/dto/pagination.dto';
import { MonitoringGateway } from '../gateways/monitoring.gateway';
import {
  ALERT_EMAIL_TRANSPORT,
  AlertEmailTransport,
} from './alert-email.transport';

export interface CriticalAlertInput {
  error_id: string;
  severity: ErrorSeverity;
  title: string;
  body?: string;
}

/**
 * Persists alerts, pushes them to the realtime dashboard, and (when recipients
 * are configured) delivers email. Each channel gets its own SystemAlert row so
 * delivery state is auditable per channel.
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MonitoringGateway,
    private readonly config: ConfigService,
    @Inject(ALERT_EMAIL_TRANSPORT)
    private readonly email: AlertEmailTransport,
  ) {}

  /** Fan a critical error out to the dashboard (realtime) and email channels. */
  async dispatchCritical(input: CriticalAlertInput): Promise<void> {
    // 1. Dashboard channel — persisted as delivered (realtime push is the delivery).
    const dashboardAlert = await this.prisma.systemAlert.create({
      data: {
        error_id: input.error_id,
        severity: input.severity,
        channel: 'DASHBOARD',
        title: input.title,
        body: input.body,
        delivered: true,
        delivered_at: new Date(),
      },
    });
    this.gateway.emitAlertCritical({
      id: dashboardAlert.id,
      error_id: input.error_id,
      severity: input.severity,
      title: input.title,
      body: input.body,
      created_at: dashboardAlert.created_at,
    });

    // 2. Email channel — only if recipients are configured.
    const recipients = (this.config.get<string>('ALERT_EMAIL_TO') ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (recipients.length === 0) return;

    const emailAlert = await this.prisma.systemAlert.create({
      data: {
        error_id: input.error_id,
        severity: input.severity,
        channel: 'EMAIL',
        title: input.title,
        body: input.body,
      },
    });
    try {
      await this.email.send({
        to: recipients,
        subject: `[${input.severity}] ${input.title}`,
        text: input.body ?? input.title,
      });
      await this.prisma.systemAlert.update({
        where: { id: emailAlert.id },
        data: { delivered: true, delivered_at: new Date() },
      });
    } catch (err) {
      this.logger.error(`Email alert delivery failed: ${(err as Error).message}`);
    }
  }

  async findAll(
    pagination: PaginationDto,
    filters: { acknowledged?: boolean; severity?: ErrorSeverity } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.SystemAlertWhereInput = {};
    if (filters.acknowledged !== undefined) where.acknowledged = filters.acknowledged;
    if (filters.severity) where.severity = filters.severity;

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.systemAlert.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: limit,
      }),
      this.prisma.systemAlert.count({ where }),
    ]);
    return new PaginatedResult(data, total, page, limit);
  }

  async acknowledge(id: string, adminId?: string) {
    const existing = await this.prisma.systemAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Alert ${id} not found`);
    return this.prisma.systemAlert.update({
      where: { id },
      data: { acknowledged: true, acknowledged_by: adminId },
    });
  }
}
