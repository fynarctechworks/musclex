'use client';

import * as React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

interface KioskPinLockProps {
  /** Storage key suffix — distinct per branch so multi-branch operators
   *  don't reuse a PIN across entrances. */
  storageKey: string;
  /** Called when a PIN is correctly entered. */
  onUnlock: () => void;
  /** Called if the operator chooses to cancel back to kiosk idle. */
  onCancel?: () => void;
  /** First-time setup mode: prompts for "Set PIN" + confirm instead of unlock. */
  setupMode?: boolean;
}

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

/**
 * On-device PIN gate for exiting kiosk mode.
 *
 * Defense model:
 *  - PIN is hashed with SHA-256 + per-branch salt before storage.
 *  - 5 wrong attempts → 60s lockout (tracked in memory + localStorage so a
 *    reload doesn't reset it).
 *  - PIN is intentionally a LOCAL gate, not a server credential. The
 *    server-side credential is the staff JWT, which never leaves
 *    localStorage. This PIN guards the *kiosk exit*, not API access.
 *
 * Setup flow:
 *  - First mount with no stored PIN → setupMode=true → enter twice → store.
 *  - Subsequent unlocks → enter once → unlock or count an attempt.
 */
export function KioskPinLock({ storageKey, onUnlock, onCancel, setupMode }: KioskPinLockProps) {
  const [digits, setDigits] = React.useState('');
  const [confirmDigits, setConfirmDigits] = React.useState('');
  const [phase, setPhase] = React.useState<'enter' | 'confirm'>(setupMode ? 'enter' : 'enter');
  const [error, setError] = React.useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = React.useState<number>(0);
  const [, setTick] = React.useState(0);

  const fullKey = `kiosk-pin:${storageKey}`;
  const attemptsKey = `${fullKey}:attempts`;
  const lockKey = `${fullKey}:lock-until`;

  // Resume lockout state on mount.
  React.useEffect(() => {
    const stored = Number(localStorage.getItem(lockKey) ?? 0);
    if (stored > Date.now()) setLockoutUntil(stored);
  }, [lockKey]);

  // Update countdown clock.
  React.useEffect(() => {
    if (lockoutUntil <= Date.now()) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil > Date.now();
  const secondsRemaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));

  const enter = (d: string) => {
    if (isLockedOut) return;
    if (phase === 'enter') {
      if (digits.length < PIN_LENGTH) setDigits((s) => s + d);
    } else {
      if (confirmDigits.length < PIN_LENGTH) setConfirmDigits((s) => s + d);
    }
  };

  const backspace = () => {
    setError(null);
    if (phase === 'enter') setDigits((s) => s.slice(0, -1));
    else setConfirmDigits((s) => s.slice(0, -1));
  };

  React.useEffect(() => {
    if (digits.length !== PIN_LENGTH) return;
    void evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  React.useEffect(() => {
    if (confirmDigits.length !== PIN_LENGTH) return;
    void evaluate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDigits]);

  async function evaluate() {
    setError(null);

    if (setupMode) {
      if (phase === 'enter') {
        setPhase('confirm');
        return;
      }
      if (digits !== confirmDigits) {
        setError("Those didn't match. Try again.");
        setDigits('');
        setConfirmDigits('');
        setPhase('enter');
        return;
      }
      const hash = await sha256(`${storageKey}:${digits}`);
      localStorage.setItem(fullKey, hash);
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockKey);
      onUnlock();
      return;
    }

    // Unlock attempt
    const expected = localStorage.getItem(fullKey);
    if (!expected) {
      // No PIN set on this device yet — unlock and let the caller decide
      // whether to immediately prompt for setup.
      onUnlock();
      return;
    }

    const got = await sha256(`${storageKey}:${digits}`);
    if (got === expected) {
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockKey);
      onUnlock();
      return;
    }

    const attempts = Number(localStorage.getItem(attemptsKey) ?? '0') + 1;
    localStorage.setItem(attemptsKey, String(attempts));
    setDigits('');

    if (attempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_MS;
      localStorage.setItem(lockKey, String(until));
      setLockoutUntil(until);
      setError(`Too many attempts. Try again in ${Math.ceil(LOCKOUT_MS / 1000)}s.`);
    } else {
      setError(`Incorrect PIN. ${MAX_ATTEMPTS - attempts} attempts left.`);
    }
  }

  const heading = setupMode
    ? phase === 'enter'
      ? 'Set kiosk exit PIN'
      : 'Confirm PIN'
    : 'Enter kiosk PIN to exit';

  const subheading = setupMode
    ? 'This PIN is required to leave kiosk mode on this device.'
    : 'Long-press the lock icon to exit anytime.';

  // Hardware-keyboard handler: numeric keys add digits, Backspace
  // removes, Esc cancels. Common for staff with paired Bluetooth
  // keyboards on entrance iPads.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isLockedOut) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        enter(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockedOut, phase]);

  // Trap focus inside the dialog: redirect any Tab to the first button.
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const c = containerRef.current;
      if (!c) return;
      const focusables = c.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => window.removeEventListener('keydown', trap);
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-pin-heading"
      aria-describedby="kiosk-pin-status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 text-on-primary backdrop-blur-sm"
    >
      <div className="w-full max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-on-primary/10">
          {setupMode ? <ShieldCheck className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
        </div>

        <h1 id="kiosk-pin-heading" className="text-3xl font-semibold">{heading}</h1>
        <p className="mt-1 text-sm text-on-primary/60">{subheading}</p>

        <div
          className="mt-8 flex justify-center gap-3"
          role="status"
          aria-live="polite"
          aria-label={`${(phase === 'enter' ? digits : confirmDigits).length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const buffer = phase === 'enter' ? digits : confirmDigits;
            const filled = i < buffer.length;
            return (
              <div
                key={i}
                aria-hidden="true"
                className={`h-4 w-4 rounded-full transition ${
                  filled ? 'bg-success' : 'bg-on-primary/20'
                }`}
              />
            );
          })}
        </div>

        <div id="kiosk-pin-status" role="status" aria-live="assertive">
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
          {isLockedOut && (
            <p className="mt-2 text-sm text-warning">Unlocks in {secondsRemaining}s</p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => enter(d)}
              disabled={isLockedOut}
              aria-label={`Digit ${d}`}
              className="rounded-lg bg-on-primary/10 py-5 text-2xl font-semibold transition hover:bg-on-primary/20 disabled:opacity-30"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel and return to kiosk"
            className="rounded-lg text-sm text-on-primary/60 hover:text-on-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => enter('0')}
            disabled={isLockedOut}
            aria-label="Digit 0"
            className="rounded-lg bg-on-primary/10 py-5 text-2xl font-semibold transition hover:bg-on-primary/20 disabled:opacity-30"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            disabled={isLockedOut}
            aria-label="Backspace"
            className="rounded-lg text-sm text-on-primary/80 transition hover:text-on-primary disabled:opacity-30"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
