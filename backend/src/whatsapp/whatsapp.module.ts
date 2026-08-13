import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppInboxService } from './whatsapp-inbox.service';
import { WhatsAppInboxController } from './whatsapp-inbox.controller';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp-provider.interface';
import { MetaCloudWhatsAppProvider } from './providers/meta-cloud.provider';
import { NoopWhatsAppProvider } from './providers/noop.provider';

/**
 * Global WhatsApp module — mirrors EmailModule. Binds the transport:
 *   - WHATSAPP_SANDBOX=true → NoopWhatsAppProvider (logs only; dev/CI)
 *   - otherwise             → MetaCloudWhatsAppProvider (official Cloud API)
 *
 * Note the transport is credential-less; WhatsAppService resolves per-gym
 * WABA credentials (Integration row) with env fallback at send time, so a
 * bound Meta provider with no credentials anywhere is still a safe no-send.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [WhatsAppWebhookController, WhatsAppInboxController],
  providers: [
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): WhatsAppProvider => {
        if (config.get<string>('WHATSAPP_SANDBOX') === 'true') {
          new Logger('WhatsAppModule').warn(
            'WHATSAPP_SANDBOX=true — using NoopWhatsAppProvider (messages are logged, not sent).',
          );
          return new NoopWhatsAppProvider();
        }
        const version = config.get<string>('WHATSAPP_GRAPH_VERSION') ?? 'v18.0';
        return new MetaCloudWhatsAppProvider(version);
      },
    },
    WhatsAppService,
    WhatsAppInboxService,
  ],
  exports: [WhatsAppService, WhatsAppInboxService, WHATSAPP_PROVIDER],
})
export class WhatsAppModule {}
