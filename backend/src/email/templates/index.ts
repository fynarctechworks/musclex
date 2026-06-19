import { EmailTemplateData, EmailTemplateId, RenderedEmail } from '../email.types';
import * as auth from './auth';
import * as saas from './saas';
import * as security from './security';

/**
 * Single dispatch point: (templateId, data) → rendered {subject, html, text}.
 * Typed so the data shape must match the template id at the call site.
 */
export function renderTemplate<T extends EmailTemplateId>(
  templateId: T,
  data: EmailTemplateData[T],
): RenderedEmail {
  switch (templateId) {
    case EmailTemplateId.VerifyEmail:
      return auth.verifyEmail(data as EmailTemplateData[EmailTemplateId.VerifyEmail]);
    case EmailTemplateId.Welcome:
      return auth.welcome(data as EmailTemplateData[EmailTemplateId.Welcome]);
    case EmailTemplateId.PasswordReset:
      return auth.passwordReset(data as EmailTemplateData[EmailTemplateId.PasswordReset]);
    case EmailTemplateId.PasswordChanged:
      return auth.passwordChanged(data as EmailTemplateData[EmailTemplateId.PasswordChanged]);
    case EmailTemplateId.TenantInvitation:
      return saas.tenantInvitation(data as EmailTemplateData[EmailTemplateId.TenantInvitation]);
    case EmailTemplateId.TrialStarted:
      return saas.trialStarted(data as EmailTemplateData[EmailTemplateId.TrialStarted]);
    case EmailTemplateId.TrialExpiring:
      return saas.trialExpiring(data as EmailTemplateData[EmailTemplateId.TrialExpiring]);
    case EmailTemplateId.SubscriptionActivated:
      return saas.subscriptionActivated(data as EmailTemplateData[EmailTemplateId.SubscriptionActivated]);
    case EmailTemplateId.SubscriptionExpired:
      return saas.subscriptionExpired(data as EmailTemplateData[EmailTemplateId.SubscriptionExpired]);
    case EmailTemplateId.PaymentSuccess:
      return saas.paymentSuccess(data as EmailTemplateData[EmailTemplateId.PaymentSuccess]);
    case EmailTemplateId.PaymentFailed:
      return saas.paymentFailed(data as EmailTemplateData[EmailTemplateId.PaymentFailed]);
    case EmailTemplateId.LoginAlert:
      return security.loginAlert(data as EmailTemplateData[EmailTemplateId.LoginAlert]);
    case EmailTemplateId.PasswordChangedAlert:
      return security.passwordChangedAlert(data as EmailTemplateData[EmailTemplateId.PasswordChangedAlert]);
    case EmailTemplateId.EmailChangedAlert:
      return security.emailChangedAlert(data as EmailTemplateData[EmailTemplateId.EmailChangedAlert]);
    default: {
      // Exhaustiveness guard — a new template id that isn't handled fails to compile.
      const _never: never = templateId;
      throw new Error(`Unknown email template: ${String(_never)}`);
    }
  }
}
