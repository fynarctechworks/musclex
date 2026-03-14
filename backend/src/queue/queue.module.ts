import { Module, Global, DynamicModule, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueService } from './queue.service';

export const QUEUE_NAMES = {
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  NOTIFICATION: 'notification',
  REPORT: 'report',
  CAMPAIGN: 'campaign',
} as const;

@Global()
@Module({})
export class QueueModule {
  private static readonly logger = new Logger(QueueModule.name);

  static register(): DynamicModule {
    const enableRedis = process.env.ENABLE_REDIS === 'true';

    if (!enableRedis) {
      QueueModule.logger.warn(
        'ENABLE_REDIS=false — BullMQ queues disabled. Jobs will be logged but not processed.',
      );
      return {
        module: QueueModule,
        imports: [PrismaModule],
        providers: [QueueService],
        exports: [QueueService],
      };
    }

    // Only import BullMQ when Redis is enabled
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BullModule } = require('@nestjs/bullmq');
    const { EmailProcessor } = require('./processors/email.processor');
    const { WebhookProcessor } = require('./processors/webhook.processor');
    const { NotificationProcessor } = require('./processors/notification.processor');
    const { ReportProcessor } = require('./processors/report.processor');
    const { CampaignProcessor } = require('./processors/campaign.processor');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getQueueToken } = require('@nestjs/bullmq');

    QueueModule.logger.log('ENABLE_REDIS=true — BullMQ queues activated');

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              host: config.get('REDIS_HOST', 'localhost'),
              port: parseInt(config.get('REDIS_PORT', '6379'), 10),
              password: config.get('REDIS_PASSWORD', undefined),
              ...(config.get('REDIS_TLS') === 'true' ? { tls: {} } : {}),
            },
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { count: 1000 },
              removeOnFail: { count: 5000 },
            },
          }),
        }),
        BullModule.registerQueue(
          { name: QUEUE_NAMES.EMAIL },
          { name: QUEUE_NAMES.WEBHOOK },
          { name: QUEUE_NAMES.NOTIFICATION },
          { name: QUEUE_NAMES.REPORT },
          { name: QUEUE_NAMES.CAMPAIGN },
        ),
        PrismaModule,
      ],
      providers: [
        {
          provide: QueueService,
          useFactory: (emailQ, webhookQ, notifQ, reportQ, campaignQ) => {
            const svc = new QueueService();
            svc.setQueues({
              [QUEUE_NAMES.EMAIL]: emailQ,
              [QUEUE_NAMES.WEBHOOK]: webhookQ,
              [QUEUE_NAMES.NOTIFICATION]: notifQ,
              [QUEUE_NAMES.REPORT]: reportQ,
              [QUEUE_NAMES.CAMPAIGN]: campaignQ,
            });
            return svc;
          },
          inject: [
            getQueueToken(QUEUE_NAMES.EMAIL),
            getQueueToken(QUEUE_NAMES.WEBHOOK),
            getQueueToken(QUEUE_NAMES.NOTIFICATION),
            getQueueToken(QUEUE_NAMES.REPORT),
            getQueueToken(QUEUE_NAMES.CAMPAIGN),
          ],
        },
        EmailProcessor,
        WebhookProcessor,
        NotificationProcessor,
        ReportProcessor,
        CampaignProcessor,
      ],
      exports: [QueueService, BullModule],
    };
  }
}
