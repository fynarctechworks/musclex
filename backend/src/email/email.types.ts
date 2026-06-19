/** All transactional templates MuscleX can send. */
export enum EmailTemplateId {
  // Auth
  VerifyEmail = 'verify-email',
  Welcome = 'welcome',
  PasswordReset = 'password-reset',
  PasswordChanged = 'password-changed',
  // SaaS
  TenantInvitation = 'tenant-invitation',
  TrialStarted = 'trial-started',
  TrialExpiring = 'trial-expiring',
  SubscriptionActivated = 'subscription-activated',
  SubscriptionExpired = 'subscription-expired',
  PaymentSuccess = 'payment-success',
  PaymentFailed = 'payment-failed',
  // Security
  LoginAlert = 'login-alert',
  PasswordChangedAlert = 'password-changed-alert',
  EmailChangedAlert = 'email-changed-alert',
}

/** A rendered email — what every template function produces. */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Per-template data contracts. Keyed by template id so `EmailService.send` is
 * fully type-checked: the wrong shape for a template won't compile.
 */
export interface EmailTemplateData {
  [EmailTemplateId.VerifyEmail]: { name?: string; verificationUrl: string; expiresInHours?: number };
  [EmailTemplateId.Welcome]: { name?: string; appUrl: string };
  [EmailTemplateId.PasswordReset]: { name?: string; resetUrl: string; expiresInMinutes?: number };
  [EmailTemplateId.PasswordChanged]: { name?: string };
  [EmailTemplateId.TenantInvitation]: { studioName: string; roleName: string; inviteUrl: string; expiresInDays?: number };
  [EmailTemplateId.TrialStarted]: { name?: string; studioName: string; trialEndsOn: string; appUrl: string };
  [EmailTemplateId.TrialExpiring]: { name?: string; studioName: string; daysLeft: number; upgradeUrl: string };
  [EmailTemplateId.SubscriptionActivated]: { name?: string; planName: string; appUrl: string };
  [EmailTemplateId.SubscriptionExpired]: { name?: string; planName: string; renewUrl: string };
  [EmailTemplateId.PaymentSuccess]: { name?: string; amount: string; planName?: string; invoiceUrl?: string };
  [EmailTemplateId.PaymentFailed]: { name?: string; amount: string; retryUrl: string; reason?: string };
  [EmailTemplateId.LoginAlert]: { name?: string; ipAddress?: string; device?: string; location?: string; when: string; secureUrl: string };
  [EmailTemplateId.PasswordChangedAlert]: { name?: string; when: string; supportUrl: string };
  [EmailTemplateId.EmailChangedAlert]: { name?: string; newEmail: string; when: string; supportUrl: string };
}

/** Parameters for `EmailService.send` — `data` is constrained to the template. */
export interface SendEmailParams<T extends EmailTemplateId = EmailTemplateId> {
  to: string | string[];
  templateId: T;
  data: EmailTemplateData[T];
  /** Override the default `From` (e.g. per-tenant white-label identity). */
  from?: string;
  replyTo?: string;
  /**
   * Idempotency key. When the queue is enabled this becomes the BullMQ jobId, so
   * the same logical email enqueued twice (e.g. double-submit) is sent once.
   */
  dedupeKey?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  queued: boolean;
  id?: string;
}
