import { Module, Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BILLING_GATEWAY } from './billing-gateway.interface';
import { SandboxGateway } from './sandbox-gateway';
import { RazorpayGateway } from './razorpay-gateway';

const logger = new Logger('BillingGatewayModule');

/**
 * Picks the active gateway based on env `BILLING_GATEWAY_PROVIDER`:
 *   - `razorpay` → live Razorpay adapter (requires RAZORPAY_KEY_ID/SECRET).
 *   - anything else (or unset) → SandboxGateway (default, safe for dev/test).
 */
const gatewayProvider: Provider = {
  provide: BILLING_GATEWAY,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const choice = (config.get<string>('BILLING_GATEWAY_PROVIDER') ?? 'sandbox').toLowerCase();
    if (choice === 'razorpay') {
      logger.log('Selected Razorpay billing gateway');
      return new RazorpayGateway(config);
    }
    logger.log(`Selected sandbox billing gateway (BILLING_GATEWAY_PROVIDER='${choice}')`);
    return new SandboxGateway(config);
  },
};

@Module({
  imports: [ConfigModule],
  providers: [gatewayProvider],
  exports: [BILLING_GATEWAY],
})
export class BillingGatewayModule {}
