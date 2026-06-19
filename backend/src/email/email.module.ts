import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_PROVIDER, EmailProvider } from './providers/email-provider.interface';
import { ResendEmailProvider } from './providers/resend.provider';
import { NoopEmailProvider } from './providers/noop.provider';

/**
 * Global email module. Provides the single `EmailService` and binds the active
 * `EMAIL_PROVIDER` based on configuration:
 *   - `RESEND_API_KEY` set  → ResendEmailProvider (real delivery)
 *   - unset                 → NoopEmailProvider (logs; never leaks links)
 *
 * To add Amazon SES / Postmark / a per-tenant white-label provider, write a new
 * class implementing EmailProvider and select it here — no caller changes.
 */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailProvider => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        if (apiKey && apiKey.trim() && apiKey !== 'your-resend-api-key') {
          return new ResendEmailProvider(apiKey.trim());
        }
        new Logger('EmailModule').warn(
          'RESEND_API_KEY not configured — using NoopEmailProvider (emails are logged, not sent).',
        );
        return new NoopEmailProvider();
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
