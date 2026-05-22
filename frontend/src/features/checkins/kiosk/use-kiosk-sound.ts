'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Web Audio API sound feedback for the kiosk.
 *
 * Three short tones — no audio assets, no preload, no licensing surface:
 *   success — 880 Hz sine, 120ms (cheerful chime)
 *   denial  — 220 Hz sawtooth, 300ms (low buzz)
 *   chirp   — 1320 Hz sine, 60ms (scan acknowledged)
 *
 * AudioContext is lazy-initialised on the first user interaction (mobile
 * Safari requires a gesture). If the user never interacts we never
 * allocate the context — no warnings, no errors.
 *
 * Returns simple play* functions. All are safe to call from anywhere;
 * if audio is blocked / unavailable they no-op silently.
 */
export interface KioskSoundApi {
  playSuccess: () => void;
  playDenial: () => void;
  playChirp: () => void;
  /** Manually unlock audio (call on first user gesture inside the kiosk). */
  unlock: () => void;
  /** True if a context exists and is in the running state. */
  ready: () => boolean;
}

const SUCCESS_HZ = 880;
const SUCCESS_MS = 120;
const DENIAL_HZ = 220;
const DENIAL_MS = 300;
const CHIRP_HZ = 1320;
const CHIRP_MS = 60;

export function useKioskSound(enabled = true): KioskSoundApi {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (!enabled) return null;
    if (typeof window === 'undefined') return null;
    if (ctxRef.current) return ctxRef.current;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, [enabled]);

  const tone = useCallback(
    (freq: number, durationMs: number, type: OscillatorType = 'sine', gain = 0.18) => {
      const ctx = getCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;

      const now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.02);
    },
    [getCtx],
  );

  const playSuccess = useCallback(() => {
    // 880Hz chime + faint 1320Hz overtone for a "ding" character.
    tone(SUCCESS_HZ, SUCCESS_MS, 'sine', 0.22);
    setTimeout(() => tone(CHIRP_HZ, 80, 'sine', 0.08), 30);
  }, [tone]);

  const playDenial = useCallback(() => {
    tone(DENIAL_HZ, DENIAL_MS, 'sawtooth', 0.18);
  }, [tone]);

  const playChirp = useCallback(() => {
    tone(CHIRP_HZ, CHIRP_MS, 'sine', 0.1);
  }, [tone]);

  const unlock = useCallback(() => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  }, [getCtx]);

  const ready = useCallback(() => ctxRef.current?.state === 'running', []);

  // Try to unlock on first interaction anywhere in the kiosk.
  useEffect(() => {
    const onAnyGesture = () => unlock();
    window.addEventListener('pointerdown', onAnyGesture, { once: true });
    window.addEventListener('keydown', onAnyGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onAnyGesture);
      window.removeEventListener('keydown', onAnyGesture);
    };
  }, [unlock]);

  useEffect(() => {
    return () => {
      try {
        ctxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { playSuccess, playDenial, playChirp, unlock, ready };
}
