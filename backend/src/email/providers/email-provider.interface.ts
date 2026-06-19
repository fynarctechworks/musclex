/**
 * The single seam between MuscleX and whatever actually puts mail on the wire.
 *
 * Every email in the codebase goes through `EmailService`, which renders a
 * template and hands a fully-formed message to one of these providers. Swapping
 * Resend for SES/Postmark — or adding a per-tenant white-label provider — means
 * writing one new class that implements this interface and binding it to the
 * `EMAIL_PROVIDER` token. No caller changes.
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

export interface ProviderEmailMessage {
  /** Sender identity, e.g. `MuscleX <noreply@mail.musclex.app>`. */
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative (always sent — improves deliverability + a11y). */
  text: string;
  replyTo?: string;
  cc?: string | string[];
  attachments?: EmailAttachment[];
}

export interface ProviderSendResult {
  /** Provider message id, when the provider returns one. */
  id?: string;
  /** False for the no-op provider (no key configured) — caller can log/skip. */
  delivered: boolean;
}

export interface EmailProvider {
  /**
   * Deliver one message. MUST throw on a transient/hard failure so the caller's
   * retry (inline) or BullMQ (queued) can react. The no-op provider never throws.
   */
  send(message: ProviderEmailMessage): Promise<ProviderSendResult>;
  /** Human-readable provider name for logs. */
  readonly name: string;
}

/** DI token for the active email provider. */
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
