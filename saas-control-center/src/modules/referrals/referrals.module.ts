import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReferralsProxyService } from './referrals-proxy.service';
import { ReferralsController } from './referrals.controller';

@Module({
  imports: [ConfigModule],
  providers: [ReferralsProxyService],
  controllers: [ReferralsController],
})
export class ReferralsModule {}
