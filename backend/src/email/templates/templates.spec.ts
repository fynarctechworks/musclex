import { EmailTemplateId, EmailTemplateData } from '../email.types';
import { renderTemplate } from './index';

/** Minimal valid sample data for every template. */
const SAMPLES: { [K in EmailTemplateId]: EmailTemplateData[K] } = {
  [EmailTemplateId.VerifyEmail]: { name: 'Phani', verificationUrl: 'https://app.test/verify?token=abc' },
  [EmailTemplateId.Welcome]: { name: 'Phani', appUrl: 'https://app.test' },
  [EmailTemplateId.PasswordReset]: { name: 'Phani', resetUrl: 'https://app.test/reset?token=abc' },
  [EmailTemplateId.PasswordChanged]: { name: 'Phani' },
  [EmailTemplateId.TenantInvitation]: { studioName: 'Iron Gym', roleName: 'front_desk', inviteUrl: 'https://app.test/invite/x' },
  [EmailTemplateId.TrialStarted]: { studioName: 'Iron Gym', trialEndsOn: 'July 1', appUrl: 'https://app.test' },
  [EmailTemplateId.TrialExpiring]: { studioName: 'Iron Gym', daysLeft: 3, upgradeUrl: 'https://app.test/billing' },
  [EmailTemplateId.SubscriptionActivated]: { planName: 'Pro', appUrl: 'https://app.test' },
  [EmailTemplateId.SubscriptionExpired]: { planName: 'Pro', renewUrl: 'https://app.test/billing' },
  [EmailTemplateId.PaymentSuccess]: { amount: '₹2,000', planName: 'Pro', invoiceUrl: 'https://app.test/inv/1' },
  [EmailTemplateId.PaymentFailed]: { amount: '₹2,000', retryUrl: 'https://app.test/billing', reason: 'Card declined' },
  [EmailTemplateId.LoginAlert]: { when: 'just now', device: 'Chrome', location: 'Hyderabad', ipAddress: '1.2.3.4', secureUrl: 'https://app.test/security' },
  [EmailTemplateId.PasswordChangedAlert]: { when: 'just now', supportUrl: 'https://app.test/support' },
  [EmailTemplateId.EmailChangedAlert]: { newEmail: 'new@test.com', when: 'just now', supportUrl: 'https://app.test/support' },
};

describe('email templates', () => {
  it.each(Object.values(EmailTemplateId))('renders %s with subject, html and text', (id) => {
    const r = renderTemplate(id, SAMPLES[id] as any);
    expect(r.subject.length).toBeGreaterThan(0);
    expect(r.html).toContain('<!DOCTYPE html>');
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.html).toContain('MuscleX');
  });

  it('escapes HTML in interpolated values (no injection — audit S3)', () => {
    const r = renderTemplate(EmailTemplateId.TenantInvitation, {
      studioName: '<script>alert(1)</script>',
      roleName: 'owner',
      inviteUrl: 'https://app.test/invite/x',
    });
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
  });
});
