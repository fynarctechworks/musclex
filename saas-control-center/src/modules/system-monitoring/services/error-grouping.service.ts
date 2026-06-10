import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ErrorSource } from '@prisma/client';

/**
 * Deterministically groups "the same" error together by computing a stable
 * fingerprint from the normalized message, the top stack frame, the module,
 * and the source. Variable bits (ids, numbers, hex, quoted literals) are
 * stripped so `user 123 not found` and `user 456 not found` collapse into one
 * group.
 */
@Injectable()
export class ErrorGroupingService {
  /** Strip request-specific noise so similar messages normalize to one title. */
  normalizeMessage(message: string): string {
    return (message || '')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>') // uuids
      .replace(/0x[0-9a-f]+/gi, '<hex>') // hex addresses
      .replace(/\b\d[\d,.]*\b/g, '<n>') // numbers
      .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '<v>') // quoted literals
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  /**
   * Extract the most relevant stack frame (first app frame). Falls back to the
   * first non-empty line. Path/line/column noise is normalized out.
   */
  topFrame(stack?: string | null): string {
    if (!stack) return '';
    const lines = stack
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('at ') || /\.(t|j)sx?:/.test(l));
    const frame = lines[0] ?? stack.split('\n')[1]?.trim() ?? '';
    return frame
      .replace(/:\d+:\d+/g, '') // strip :line:col
      .replace(/\((.*?)\)/, (_m, p) => `(${p.split(/[/\\]/).pop()})`) // basename only
      .slice(0, 200);
  }

  fingerprint(input: {
    message: string;
    source: ErrorSource;
    module?: string | null;
    stack_trace?: string | null;
  }): string {
    const parts = [
      this.normalizeMessage(input.message),
      this.topFrame(input.stack_trace),
      input.module ?? '',
      input.source,
    ];
    return createHash('sha1').update(parts.join('|')).digest('hex');
  }

  /** Human-readable group title derived from the normalized message. */
  title(message: string): string {
    const t = this.normalizeMessage(message);
    return t.length > 0 ? t : 'Unknown error';
  }
}
