import { EmailTemplateData, EmailTemplateId, RenderedEmail } from '../email.types';
import { p, pRaw, strong, renderLayout, renderText, esc } from './layout';

const greeting = (name?: string) => (name ? `Hi ${name},` : 'Hi,');

export function verifyEmail(d: EmailTemplateData[EmailTemplateId.VerifyEmail]): RenderedEmail {
  const hours = d.expiresInHours ?? 24;
  return {
    subject: 'Verify your MuscleX account',
    html: renderLayout({
      preheader: 'Confirm your email to finish setting up your studio.',
      heading: 'Verify your email',
      bodyHtml:
        p(greeting(d.name)) +
        p('Thanks for signing up. Confirm your email address to finish setting up your studio.'),
      cta: { label: 'Verify email address', url: d.verificationUrl },
      footnoteHtml: `This link expires in ${esc(hours)} hours. If you didn't create a MuscleX account, you can safely ignore this email.`,
    }),
    text: renderText('Verify your email', [
      greeting(d.name),
      `Confirm your email to finish setting up your studio. This link expires in ${hours} hours:`,
    ], d.verificationUrl),
  };
}

export function welcome(d: EmailTemplateData[EmailTemplateId.Welcome]): RenderedEmail {
  return {
    subject: 'Welcome to MuscleX',
    html: renderLayout({
      preheader: 'Your studio is ready. Here is how to get started.',
      heading: 'Welcome to MuscleX',
      bodyHtml:
        p(greeting(d.name)) +
        p('Your account is verified and your studio is ready. Jump in to add your branches, members, and class schedule.'),
      cta: { label: 'Open MuscleX', url: d.appUrl },
    }),
    text: renderText('Welcome to MuscleX', [
      greeting(d.name),
      'Your studio is ready. Open MuscleX to get started:',
    ], d.appUrl),
  };
}

export function passwordReset(d: EmailTemplateData[EmailTemplateId.PasswordReset]): RenderedEmail {
  const mins = d.expiresInMinutes ?? 30;
  return {
    subject: 'Reset your MuscleX password',
    html: renderLayout({
      preheader: 'Reset your password — link expires soon.',
      heading: 'Reset your password',
      bodyHtml:
        p(greeting(d.name)) +
        p('We received a request to reset your password. Click below to choose a new one.'),
      cta: { label: 'Reset password', url: d.resetUrl },
      footnoteHtml: `This link expires in ${esc(mins)} minutes. If you didn't request this, ignore this email — your password won't change.`,
    }),
    text: renderText('Reset your password', [
      greeting(d.name),
      `Reset your password using the link below (expires in ${mins} minutes). If you didn't request this, ignore this email:`,
    ], d.resetUrl),
  };
}

export function passwordChanged(d: EmailTemplateData[EmailTemplateId.PasswordChanged]): RenderedEmail {
  return {
    subject: 'Your MuscleX password was changed',
    html: renderLayout({
      preheader: 'Your password was changed successfully.',
      heading: 'Your password was changed',
      bodyHtml:
        p(greeting(d.name)) +
        pRaw(`Your MuscleX password was just changed. If this was you, ${strong('no action is needed')}.`) +
        p("If you didn't make this change, reset your password immediately and contact support."),
    }),
    text: renderText('Your password was changed', [
      greeting(d.name),
      "Your MuscleX password was just changed. If this wasn't you, reset it immediately and contact support.",
    ]),
  };
}
