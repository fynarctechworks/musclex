import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

export interface AlertEmailMessage {
  to: string[];
  subject: string;
  text: string;
}

/** Pluggable email transport for critical alerts. */
export interface AlertEmailTransport {
  send(message: AlertEmailMessage): Promise<void>;
}

export const ALERT_EMAIL_TRANSPORT = 'ALERT_EMAIL_TRANSPORT';

/**
 * Real transport: delivers critical alerts via the SCC EmailService (Resend).
 * Throws on failure so AlertService leaves the SystemAlert row undelivered.
 * Bound in system-monitoring.module when RESEND_API_KEY is configured.
 */
@Injectable()
export class ResendAlertEmailTransport implements AlertEmailTransport {
  constructor(private readonly email: EmailService) {}

  async send(message: AlertEmailMessage): Promise<void> {
    await this.email.sendRaw({
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

/**
 * Default transport: logs the alert instead of sending.
 *
 * The SCC has no email provider wired yet (password reset logs its URL too —
 * see auth.service `forgotPassword`). When a provider is chosen (Resend / SMTP /
 * SES), implement AlertEmailTransport against it and swap the binding in
 * system-monitoring.module.ts. That provider choice is a new dependency, so it's
 * intentionally left out of this phase.
 */
@Injectable()
export class LoggingAlertEmailTransport implements AlertEmailTransport {
  private readonly logger = new Logger('AlertEmail');

  async send(message: AlertEmailMessage): Promise<void> {
    this.logger.warn(
      `[ALERT EMAIL — provider not wired] to=${message.to.join(',')} subject="${message.subject}"`,
    );
  }
}
