import { EmailTemplateData, EmailTemplateId, RenderedEmail } from '../email.types';
import { p, pRaw, strong, detailRow, detailTable, renderLayout, renderText, esc } from './layout';

const greeting = (name?: string) => (name ? `Hi ${name},` : 'Hi,');

export function tenantInvitation(d: EmailTemplateData[EmailTemplateId.TenantInvitation]): RenderedEmail {
  const days = d.expiresInDays ?? 7;
  const role = d.roleName.replace(/_/g, ' ');
  return {
    subject: `You've been invited to ${d.studioName} on MuscleX`,
    html: renderLayout({
      preheader: `Join ${d.studioName} as ${role}.`,
      heading: "You've been invited",
      bodyHtml:
        pRaw(`${strong(d.studioName)} has invited you to join their team on MuscleX as ${strong(role)}.`) +
        p('Accept the invite to set up your account and get started.'),
      cta: { label: 'Accept invite', url: d.inviteUrl },
      footnoteHtml: `This invite expires in ${esc(days)} days. If you weren't expecting it, you can ignore this email.`,
    }),
    text: renderText("You've been invited", [
      `${d.studioName} invited you to join as ${role}.`,
      `Accept the invite (expires in ${days} days):`,
    ], d.inviteUrl),
  };
}

export function trialStarted(d: EmailTemplateData[EmailTemplateId.TrialStarted]): RenderedEmail {
  return {
    subject: `Your MuscleX trial for ${d.studioName} has started`,
    html: renderLayout({
      preheader: `Your free trial runs until ${d.trialEndsOn}.`,
      heading: 'Your free trial has started',
      bodyHtml:
        p(greeting(d.name)) +
        pRaw(`Your free trial for ${strong(d.studioName)} is active until ${strong(d.trialEndsOn)}. Explore everything MuscleX offers — no limits during the trial.`),
      cta: { label: 'Open your dashboard', url: d.appUrl },
    }),
    text: renderText('Your free trial has started', [
      greeting(d.name),
      `Your trial for ${d.studioName} runs until ${d.trialEndsOn}.`,
    ], d.appUrl),
  };
}

export function trialExpiring(d: EmailTemplateData[EmailTemplateId.TrialExpiring]): RenderedEmail {
  return {
    subject: `Your MuscleX trial ends in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`,
    html: renderLayout({
      preheader: `Upgrade to keep ${d.studioName} running without interruption.`,
      heading: 'Your trial is ending soon',
      bodyHtml:
        p(greeting(d.name)) +
        pRaw(`Your trial for ${strong(d.studioName)} ends in ${strong(`${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`)}. Upgrade now to keep your members, classes, and payments running without interruption.`),
      cta: { label: 'Choose a plan', url: d.upgradeUrl },
    }),
    text: renderText('Your trial is ending soon', [
      greeting(d.name),
      `Your trial for ${d.studioName} ends in ${d.daysLeft} day(s). Upgrade to continue:`,
    ], d.upgradeUrl),
  };
}

export function subscriptionActivated(d: EmailTemplateData[EmailTemplateId.SubscriptionActivated]): RenderedEmail {
  return {
    subject: 'Your MuscleX subscription is active',
    html: renderLayout({
      preheader: `You're on the ${d.planName} plan.`,
      heading: 'Subscription activated',
      bodyHtml:
        p(greeting(d.name)) +
        pRaw(`You're now on the ${strong(d.planName)} plan. Thanks for choosing MuscleX.`),
      cta: { label: 'Open your dashboard', url: d.appUrl },
    }),
    text: renderText('Subscription activated', [
      greeting(d.name),
      `You're now on the ${d.planName} plan. Thanks for choosing MuscleX.`,
    ], d.appUrl),
  };
}

export function subscriptionExpired(d: EmailTemplateData[EmailTemplateId.SubscriptionExpired]): RenderedEmail {
  return {
    subject: 'Your MuscleX subscription has expired',
    html: renderLayout({
      preheader: 'Renew to restore full access.',
      heading: 'Your subscription has expired',
      bodyHtml:
        p(greeting(d.name)) +
        pRaw(`Your ${strong(d.planName)} subscription has expired and your studio is now in read-only mode. Renew to restore full access.`),
      cta: { label: 'Renew subscription', url: d.renewUrl },
    }),
    text: renderText('Your subscription has expired', [
      greeting(d.name),
      `Your ${d.planName} subscription expired. Renew to restore full access:`,
    ], d.renewUrl),
  };
}

export function paymentSuccess(d: EmailTemplateData[EmailTemplateId.PaymentSuccess]): RenderedEmail {
  const rows = [detailRow('Amount', d.amount)];
  if (d.planName) rows.push(detailRow('Plan', d.planName));
  return {
    subject: 'Payment received — thank you',
    html: renderLayout({
      preheader: `We received your payment of ${d.amount}.`,
      heading: 'Payment received',
      bodyHtml:
        p(greeting(d.name)) +
        p('Thanks — your payment was processed successfully.') +
        detailTable(rows),
      ...(d.invoiceUrl ? { cta: { label: 'View invoice', url: d.invoiceUrl } } : {}),
    }),
    text: renderText('Payment received', [
      greeting(d.name),
      `We received your payment of ${d.amount}${d.planName ? ` for the ${d.planName} plan` : ''}.`,
    ], d.invoiceUrl),
  };
}

export function paymentFailed(d: EmailTemplateData[EmailTemplateId.PaymentFailed]): RenderedEmail {
  const rows = [detailRow('Amount due', d.amount)];
  if (d.reason) rows.push(detailRow('Reason', d.reason));
  return {
    subject: 'Action needed: your MuscleX payment failed',
    html: renderLayout({
      preheader: 'Update your payment method to avoid interruption.',
      heading: 'Your payment failed',
      bodyHtml:
        p(greeting(d.name)) +
        p("We couldn't process your latest payment. Update your payment method to avoid losing access.") +
        detailTable(rows),
      cta: { label: 'Update payment', url: d.retryUrl },
    }),
    text: renderText('Your payment failed', [
      greeting(d.name),
      `We couldn't process your payment of ${d.amount}${d.reason ? ` (${d.reason})` : ''}. Update your payment method:`,
    ], d.retryUrl),
  };
}
