'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseIdleLockOptions {
  /** Idle timeout in ms before onIdle fires. Default 5 minutes. */
  idleMs?: number;
  /** Fires when the user has been idle for `idleMs`. */
  onIdle: () => void;
  /** Set to false to suspend the timer (e.g. while a modal is open). */
  enabled?: boolean;
}

/**
 * Idle detector for kiosk auto-lock.
 *
 * Tracks pointer / keyboard / touch / wheel events. After `idleMs` with
 * no activity, fires `onIdle`. Exposes `bump()` so callers can manually
 * extend the deadline (e.g. immediately after a successful check-in
 * to keep the hero overlay from dismissing prematurely).
 */
export function useIdleLock({ idleMs = 5 * 60 * 1000, onIdle, enabled = true }: UseIdleLockOptions) {
  const onIdleRef = useRef(onIdle);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const arm = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled) return;
    timerRef.current = setTimeout(() => {
      setIdle(true);
      onIdleRef.current();
    }, idleMs);
  }, [enabled, idleMs]);

  const bump = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (idle) setIdle(false);
    arm();
  }, [arm, idle]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    arm();

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];
    const onActivity = () => bump();
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });

    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, arm, bump]);

  return { idle, bump, msSinceActivity: () => Date.now() - lastActivityRef.current };
}
