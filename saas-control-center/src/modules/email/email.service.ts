import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_FROM = 'MuscleX SCC <noreply@musclex.app>';
const INK = '#171717';
const HAIRLINE = '#ebebeb';
const BODY = '#4d4d4d';

/** Escape interpolated values before placing them in HTML. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * SCC email service — the single Resend seam for the Control Center, mirroring
 * `backend/src/email`. The SDK is imported dynamically and only used when
 * RESEND_API_KEY is configured; otherwise sends are logged (never silently
 * succeeding, never leaking links).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly from: string;
  private client: any;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.apiKey = key && key.trim() && key !== 'your-resend-api-key' ? key.trim() : undefined;
    this.from = this.config.get<string>('RESEND_FROM_EMAIL', DEFAULT_FROM);
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — SCC emails are logged, not sent.');
    }
  }

  get enabled(): boolean {
    return !!this.apiKey;
  }

  /** Low-level send. Throws on provider failure so callers can react. */
  async sendRaw(params: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ id?: string; delivered: boolean }> {
    if (!this.apiKey) {
      const to = Array.isArray(params.to) ? params.to.join(',') : params.to;
      this.logger.warn(`[no provider] would send to=${to} subject="${params.subject}"`);
      return { delivered: false };
    }
    if (!this.client) {
      const { Resend } = await import('resend');
      this.client = new Resend(this.apiKey);
    }
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      ...(params.html ? { html: params.html } : {}),
      text: params.text ?? (params.html ? params.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : params.subject),
    });
    if (error) {
      throw new Error(`Resend rejected message: ${error.message ?? JSON.stringify(error)}`);
    }
    return { id: data?.id, delivered: true };
  }

  /** Branded admin password-reset email. */
  async sendPasswordReset(to: string, resetUrl: string, expiresInMinutes = 30): Promise<void> {
    const html = this.layout(
      'Reset your password',
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BODY};">
         We received a request to reset your MuscleX Control Center password. Click below to choose a new one.
       </p>`,
      { label: 'Reset password', url: resetUrl },
      `This link expires in ${esc(expiresInMinutes)} minutes. If you didn't request this, ignore this email — your password won't change.`,
    );
    await this.sendRaw({
      to,
      subject: 'Reset your MuscleX Control Center password',
      html,
      text: `Reset your MuscleX Control Center password (expires in ${expiresInMinutes} minutes): ${resetUrl}`,
    });
  }

  /** Minimal Geist-monochrome layout (kept local to SCC). Inputs are escaped. */
  private layout(
    heading: string,
    bodyHtml: string,
    cta: { label: string; url: string },
    footnote: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
             style="max-width:480px;width:100%;background:#fff;border:1px solid ${HAIRLINE};border-radius:12px;">
        <tr><td style="padding:32px 32px 8px;font-weight:700;font-size:16px;color:${INK};">MuscleX Control Center</td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${INK};">${esc(heading)}</h1>
          ${bodyHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
            <tr><td align="center" bgcolor="${INK}" style="border-radius:8px;">
              <a href="${esc(cta.url)}" target="_blank"
                 style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">
                ${esc(cta.label)}
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#888;">${footnote}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }
}
