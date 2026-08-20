'use client';

import { useEffect, useState } from 'react';

/**
 * The headline's cycling gradient word.
 *
 * Two details that matter:
 *  - The slot is sized by an invisible copy of the LONGEST word, so the words
 *    after it never reflow the headline as they swap. A jumping headline is
 *    worse than no animation at all.
 *  - It respects `prefers-reduced-motion`: users who ask for less motion get
 *    the first word, static, and no interval is ever started.
 */
export function RotatingWord({
  words,
  intervalMs = 2200,
  className,
}: {
  words: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (query.matches) return;

    setAnimate(true);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [words.length, intervalMs]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');

  return (
    <span className={`relative inline-grid align-baseline ${className ?? ''}`}>
      {/* Reserves the width of the widest word so the line never reflows. */}
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longest}
      </span>
      <span
        // The whole rotating set is announced once; the visual swap is decorative.
        aria-label={words.join(', ')}
        className="col-start-1 row-start-1 flex justify-center overflow-hidden"
      >
        <span
          key={index}
          className={`text-gradient whitespace-nowrap ${animate ? 'animate-word-in' : ''}`}
        >
          {words[index]}
        </span>
      </span>
    </span>
  );
}
