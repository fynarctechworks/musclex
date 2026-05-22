'use client';

import { useRef, useState, useCallback, useImperativeHandle, useEffect, forwardRef, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface VerifyCodeInputRef {
  reset: () => void;
}

interface VerifyCodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const VerifyCodeInput = forwardRef<VerifyCodeInputRef, VerifyCodeInputProps>(
  function VerifyCodeInput(
    {
      length = 6,
      onComplete,
      disabled = false,
      error = false,
      className,
    },
    ref,
  ) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
      }
    },
    [length],
  );

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only accept digits
      const digit = value.replace(/\D/g, '').slice(-1);
      const next = [...values];
      next[index] = digit;
      setValues(next);

      if (digit && index < length - 1) {
        focusInput(index + 1);
      }

      // Check if all filled
      if (digit && next.every((v) => v !== '')) {
        onComplete(next.join(''));
      }
    },
    [values, length, focusInput, onComplete],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (!values[index] && index > 0) {
          focusInput(index - 1);
          const next = [...values];
          next[index - 1] = '';
          setValues(next);
        } else {
          const next = [...values];
          next[index] = '';
          setValues(next);
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight' && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [values, length, focusInput],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;

      const next = [...values];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setValues(next);

      // Focus the next empty slot or last
      const nextEmpty = next.findIndex((v) => v === '');
      focusInput(nextEmpty === -1 ? length - 1 : nextEmpty);

      if (next.every((v) => v !== '')) {
        onComplete(next.join(''));
      }
    },
    [values, length, focusInput, onComplete],
  );

  const reset = useCallback(() => {
    setValues(Array(length).fill(''));
    focusInput(0);
  }, [length, focusInput]);

  useImperativeHandle(ref, () => ({ reset }), [reset]);

  useEffect(() => {
    if (!disabled) {
      focusInput(0);
    }
  }, [disabled, focusInput]);

  return (
    <div className={cn('flex gap-2 justify-center', className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={cn(
            'w-12 h-14 text-center text-xl font-mono rounded-lg border transition-all duration-fast',
            'bg-background text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
            error
              ? 'border-destructive ring-1 ring-destructive'
              : 'border-border',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      ))}
    </div>
  );
  },
);
