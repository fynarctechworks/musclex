import { EmailTemplateData, EmailTemplateId, RenderedEmail } from '../email.types';
import { p, detailRow, detailTable, renderLayout, renderText } from './layout';

const greeting = (name?: string) => (name ? `Hi ${name},` : 'Hi,');

export function loginAlert(d: EmailTemplateData[EmailTemplateId.LoginAlert]): RenderedEmail {
  const rows = [detailRow('When', d.when)];
  if (d.device) rows.push(detailRow('Device', d.device));
  if (d.location) rows.push(detailRow('Location', d.location));
  if (d.ipAddress) rows.push(detailRow('IP address', d.ipAddress));
  return {
    subject: 'New sign-in to your MuscleX account',
    html: renderLayout({
      preheader: 'We noticed a new sign-in to your account.',
      heading: 'New sign-in detected',
      bodyHtml:
        p(greeting(d.name)) +
        p('We noticed a new sign-in to your MuscleX account.') +
        detailTable(rows) +
        p("If this was you, no action is needed. If you don't recognise it, secure your account now."),
      cta: { label: 'Secure my account', url: d.secureUrl },
    }),
    text: renderText('New sign-in detected', [
      greeting(d.name),
      `New sign-in at ${d.when}${d.device ? ` from ${d.device}` : ''}${d.location ? ` (${d.location})` : ''}.`,
      "If this wasn't you, secure your account:",
    ], d.secureUrl),
  };
}

export function passwordChangedAlert(d: EmailTemplateData[EmailTemplateId.PasswordChangedAlert]): RenderedEmail {
  return {
    subject: 'Security alert: your password was changed',
    html: renderLayout({
      preheader: 'Your password was changed.',
      heading: 'Your password was changed',
      bodyHtml:
        p(greeting(d.name)) +
        detailTable([detailRow('When', d.when)]) +
        p("If this was you, no action is needed. If not, contact support immediately — your account may be compromised."),
      cta: { label: 'Contact support', url: d.supportUrl },
    }),
    text: renderText('Your password was changed', [
      greeting(d.name),
      `Your password was changed at ${d.when}. If this wasn't you, contact support immediately:`,
    ], d.supportUrl),
  };
}

export function emailChangedAlert(d: EmailTemplateData[EmailTemplateId.EmailChangedAlert]): RenderedEmail {
  return {
    subject: 'Security alert: your account email was changed',
    html: renderLayout({
      preheader: 'The email on your account was changed.',
      heading: 'Your account email was changed',
      bodyHtml:
        p(greeting(d.name)) +
        detailTable([detailRow('New email', d.newEmail), detailRow('When', d.when)]) +
        p("If this was you, no action is needed. If not, contact support immediately."),
      cta: { label: 'Contact support', url: d.supportUrl },
    }),
    text: renderText('Your account email was changed', [
      greeting(d.name),
      `Your account email was changed to ${d.newEmail} at ${d.when}. If this wasn't you, contact support immediately:`,
    ], d.supportUrl),
  };
}
