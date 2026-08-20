'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { cx } from '@/components/ui';
import { contactEmail } from '@/lib/site';

/**
 * Contact form.
 *
 * Submits to this app's own `/api/contact` route handler, which forwards the
 * enquiry to the SaaS Control Center with a shared secret. The SCC endpoint is
 * never called from the browser, so no secret and no internal URL reach the
 * bundle.
 *
 * Submissions land in SCC › Gym Owner Leads.
 */

const fieldClass =
  'w-full rounded-md border border-hairline bg-glass-1 px-3.5 py-3 text-body-sm text-text placeholder:text-text-4 transition-colors duration-fast focus:border-hairline-strong focus:bg-glass-2 focus:outline-none focus:ring-2 focus:ring-accent-bright focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-60';

const labelClass = 'flex flex-col gap-2 text-body-sm font-medium text-text-2';

const enquiryTypes = [
  'Product question',
  'Pricing and plans',
  'Migrating from another system',
  'Multi-branch / Enterprise',
  'Partnership',
  'Something else',
];

type State = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setState('sending');
    setError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Something went wrong.');
      }

      form.reset();
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
        </span>
        <div>
          <h2 className="text-title">Thanks, we have your enquiry.</h2>
          <p className="mt-2 text-body-sm text-text-3">
            Someone from the team will get back to you shortly. If it is urgent, email us
            at{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="text-accent underline underline-offset-4"
            >
              {contactEmail}
            </a>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="text-caption text-text-3 underline underline-offset-4 transition-colors duration-fast hover:text-text"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  const disabled = state === 'sending';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/*
        Honeypot. Hidden from humans and skipped by the tab order, but bots that
        fill every input will populate it. The server discards those silently.
      */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Your name
          <input
            name="name"
            type="text"
            required
            disabled={disabled}
            autoComplete="name"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Gym or studio
          <input
            name="studio"
            type="text"
            required
            disabled={disabled}
            autoComplete="organization"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            disabled={disabled}
            autoComplete="email"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Phone
          <input
            name="phone"
            type="tel"
            required
            disabled={disabled}
            autoComplete="tel"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Number of branches
          <select
            name="branches"
            defaultValue="1"
            disabled={disabled}
            className={cx(fieldClass, 'appearance-none')}
          >
            <option value="1">1 branch</option>
            <option value="2-5">2–5 branches</option>
            <option value="6-20">6–20 branches</option>
            <option value="20+">More than 20</option>
          </select>
        </label>
        <label className={labelClass}>
          What is this about?
          <select
            name="topic"
            defaultValue={enquiryTypes[0]}
            disabled={disabled}
            className={cx(fieldClass, 'appearance-none')}
          >
            {enquiryTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        How can we help?
        <textarea
          name="message"
          rows={5}
          required
          disabled={disabled}
          placeholder="Tell us how you run your studio today, and what you are trying to fix."
          className={cx(fieldClass, 'resize-y')}
        />
      </label>

      {state === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-accent/8 px-3.5 py-3 text-body-sm text-accent"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {error}{' '}
            <a href={`mailto:${contactEmail}`} className="underline underline-offset-4">
              Email us instead
            </a>
            .
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-accent px-7 text-body font-medium text-accent-ink shadow-cta transition-all duration-fast hover:bg-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-70"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {disabled ? 'Sending…' : 'Send enquiry'}
        </button>
        <p className="text-caption text-text-4">
          We reply to every enquiry. No newsletter, no sales sequence.
        </p>
      </div>
    </form>
  );
}
