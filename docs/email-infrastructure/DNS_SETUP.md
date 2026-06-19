# Email Domain Authentication — DNS Setup Guide (SPF / DKIM / DMARC)

_For the MuscleX sending domain on **Resend**. All steps are **[OPERATOR ACTION]** — they
require access to the Resend dashboard and your DNS provider; they cannot be done from the
repo._

## Why this matters

Without SPF, DKIM, and DMARC, mailbox providers (Gmail/Outlook/Yahoo) throttle or junk
your mail, and as of 2024 Gmail/Yahoo **require** authentication for bulk senders. For a
SaaS that sends verification + password-reset mail, an unauthenticated domain means users
never get the email and can't sign in.

## Recommended setup: a dedicated sending subdomain

Send from a **subdomain** (e.g. `mail.musclex.app`), not the root domain. This isolates
sending reputation from your corporate mail and is what Resend recommends.

- `RESEND_FROM_EMAIL = MuscleX <noreply@mail.musclex.app>`
- `EMAIL_REPLY_TO   = support@musclex.app` (a real, monitored inbox)

## Step 1 — Add & verify the domain in Resend

1. Resend dashboard → **Domains → Add Domain** → enter `mail.musclex.app`.
2. Resend generates the exact records below (values are **per-domain** — copy yours from
   the dashboard; the ones here are the *shape*).
3. Add them at your DNS provider, then click **Verify**.

## Step 2 — DNS records

> Replace example values with the exact ones Resend shows you. TTL 3600 is fine.

### DKIM (Resend provides the selector + public key)
```
Type:  TXT  (or CNAME, depending on what Resend issues)
Name:  resend._domainkey.mail.musclex.app
Value: p=MIGfMA0GCSqGSIb3DQEB...  (the long key from the dashboard)
```

### SPF (authorizes Resend/SES to send for the subdomain)
```
Type:  TXT
Name:  mail.musclex.app
Value: v=spf1 include:amazonses.com ~all
```
- If the subdomain already has an SPF record, **merge** — only one SPF TXT record is
  allowed. Use the `include:` value Resend specifies.

### MX (Resend may request one for the sending subdomain — use the dashboard value)
```
Type:  MX
Name:  send.mail.musclex.app   (per dashboard)
Value: feedback-smtp.<region>.amazonses.com   (priority 10)
```

### DMARC (start at monitor, then tighten)
```
Type:  TXT
Name:  _dmarc.musclex.app
Value: v=DMARC1; p=none; rua=mailto:dmarc@musclex.app; fo=1; adkim=s; aspf=s
```
- **Phase 1 (launch):** `p=none` — monitor reports, change nothing for senders.
- **Phase 2 (after ~2 weeks of clean reports):** `p=quarantine; pct=25` → ramp `pct` to 100.
- **Phase 3 (steady state):** `p=reject`.
- `adkim=s; aspf=s` = strict alignment (recommended once you send only from the subdomain).

## Step 3 — Verify alignment

After DNS propagates (minutes–hours):
1. Resend dashboard shows the domain **Verified** (green) with DKIM/SPF passing.
2. Send a test to a Gmail account → **Show original** → confirm:
   - `DKIM: PASS`
   - `SPF: PASS`
   - `DMARC: PASS`
3. Use [mail-tester.com](https://www.mail-tester.com) for a deliverability score (aim ≥ 9/10).

## Multi-tenant / white-label note

Each brand or white-label tenant that sends from its own domain needs its **own verified
domain** in Resend with its own DKIM/SPF/DMARC records. The `EmailProvider` seam already
supports a per-message `from`, so adding a tenant brand = verify its domain + store its
`from` identity; no code change.

## Supabase Auth emails

If any flow still uses Supabase-sent email (currently: gym password reset via
`resetPasswordForEmail`), configure **Supabase → Authentication → Email** to use **custom
SMTP** pointed at Resend's SMTP credentials, so those messages are also authenticated under
your domain. Otherwise they send from Supabase's shared domain and will look inconsistent.
**[OPERATOR ACTION]** — Supabase dashboard.
