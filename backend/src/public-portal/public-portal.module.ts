import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MembersModule } from '../members/members.module';
import { MarketingModule } from '../marketing/marketing.module';
import { PaymentsModule } from '../payments/payments.module';
import { PublicPortalController, PublicCheckoutController } from './public-portal.controller';
import { PublicPortalService } from './public-portal.service';

/** Public per-gym self-serve portal (see PublicPortalService for the security model). */
@Module({
  imports: [PrismaModule, MembersModule, MarketingModule, PaymentsModule],
  controllers: [PublicPortalController, PublicCheckoutController],
  providers: [PublicPortalService],
})
export class PublicPortalModule {}
