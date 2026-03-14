import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { PlatformSettingsService } from './services/platform-settings.service';
import { IntegrationsService } from './services/integrations.service';
import { WebhooksService } from './services/webhooks.service';

import { PlatformController } from './controllers/platform.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { WebhooksController } from './controllers/webhooks.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    PlatformController,
    IntegrationsController,
    WebhooksController,
  ],
  providers: [
    PlatformSettingsService,
    IntegrationsService,
    WebhooksService,
  ],
  exports: [
    PlatformSettingsService,
    IntegrationsService,
    WebhooksService,
  ],
})
export class PlatformModule {}
