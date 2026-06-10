'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

type Provider = 'google' | 'apple';

/** Brand glyphs — inline SVG so there's no extra asset/network dependency. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 text-foreground" fill="currentColor">
      <path d="M11.18 8.46c.02 2.16 1.9 2.88 1.92 2.89-.02.05-.3 1.02-.99 2.02-.6.87-1.22 1.74-2.2 1.76-.96.02-1.27-.57-2.37-.57-1.1 0-1.44.55-2.35.59-.95.03-1.67-.94-2.27-1.8C.5 11.56-.45 8.3.77 6.1c.6-1.09 1.69-1.78 2.87-1.8.93-.02 1.81.63 2.38.63.57 0 1.64-.78 2.76-.66.47.02 1.79.19 2.63 1.43-.07.04-1.57.92-1.55 2.76M9.4 3.3c.5-.61.84-1.46.75-2.3-.72.03-1.6.48-2.12 1.09-.47.54-.88 1.4-.77 2.23.8.06 1.63-.41 2.14-1.02" />
    </svg>
  );
}

const PROVIDERS: Record<Provider, { label: string; icon: () => JSX.Element }> = {
  google: { label: 'Continue with Google', icon: GoogleIcon },
  apple: { label: 'Continue with Apple', icon: AppleIcon },
};

/**
 * Pre-flight: ask Supabase's public `/auth/v1/settings` whether a provider is
 * actually enabled BEFORE we hand the browser off to it.
 *
 * `signInWithOAuth` performs a full-page redirect and does not validate the
 * provider client-side, so a disabled provider lands the user on a raw Supabase
 * "400 Bad Request" page. Checking first lets us show a clear in-app message
 * instead. Fails OPEN (returns true) on any probe failure so a transient blip
 * never blocks a legitimate sign-in — Supabase stays authoritative.
 */
async function isProviderEnabled(provider: Provider): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return true;
    const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (!res.ok) return true;
    const data = (await res.json()) as { external?: Record<string, boolean> };
    return data?.external?.[provider] === true;
  } catch {
    return true;
  }
}

interface SocialAuthButtonsProps {
  /** Which providers to render. Defaults to Google only. */
  providers?: Provider[];
  /** Disable while a sibling form is submitting. */
  disabled?: boolean;
}

/**
 * Social sign-in buttons (Google / Apple).
 *
 * Kicks off the Supabase OAuth handshake; the provider redirects back to
 * `/auth/callback`, which hands the resulting session to the backend
 * (`/auth/oauth/sync`) and routes the user (fresh → onboarding, returning →
 * dashboard). Works for both sign-in and sign-up — the same Google account
 * resolves to the same user either way.
 */
export function SocialAuthButtons({
  providers = ['google'],
  disabled = false,
}: SocialAuthButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);

  const handleClick = async (provider: Provider) => {
    setPending(provider);
    try {
      // Pre-flight: don't redirect to a provider Supabase hasn't enabled yet —
      // it would dead-end on a raw 400 page. Show a clear message instead.
      const enabled = await isProviderEnabled(provider);
      if (!enabled) {
        toast.error(
          `${PROVIDERS[provider].label.replace('Continue with ', '')} sign-in isn't enabled yet. Please use email and password.`,
        );
        setPending(null);
        return;
      }

      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // Apple only returns name/email on the very first authorization, so
          // request them explicitly.
          scopes: provider === 'apple' ? 'name email' : undefined,
          // Ask Google for a refresh token + force account chooser so users can
          // pick which account to use.
          queryParams:
            provider === 'google'
              ? { access_type: 'offline', prompt: 'select_account' }
              : undefined,
        },
      });

      if (error) {
        // Most common cause in a fresh project: the provider isn't enabled in
        // the Supabase dashboard yet. Surface a clear message instead of a
        // silent failure.
        const msg = /provider is not enabled/i.test(error.message)
          ? `${PROVIDERS[provider].label.replace('Continue with ', '')} sign-in isn't enabled yet. Please use email and password.`
          : error.message || 'Could not start sign-in. Please try again.';
        toast.error(msg);
        setPending(null);
      }
      // On success the browser redirects to the provider — no further UI here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start sign-in.');
      setPending(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {providers.map((provider) => {
        const { label, icon: Icon } = PROVIDERS[provider];
        const isPending = pending === provider;
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            disabled={disabled || pending !== null}
            onClick={() => handleClick(provider)}
            aria-label={label}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon />}
            <span>{label}</span>
          </Button>
        );
      })}
    </div>
  );
}

/** Small "or" divider used between the social row and the email form. */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="relative my-5 flex items-center">
      <div className="flex-grow border-t border-hairline" />
      <span className="mx-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex-grow border-t border-hairline" />
    </div>
  );
}
