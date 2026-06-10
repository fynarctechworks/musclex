import { ErrorGroupingService } from './error-grouping.service';
import { ErrorSource } from '@prisma/client';

describe('ErrorGroupingService', () => {
  const svc = new ErrorGroupingService();

  describe('normalizeMessage', () => {
    it('strips numbers so the same error with different ids collapses', () => {
      expect(svc.normalizeMessage('user 123 not found')).toBe(
        svc.normalizeMessage('user 456 not found'),
      );
    });

    it('strips uuids, hex and quoted literals', () => {
      const a = svc.normalizeMessage(
        "Tenant '550e8400-e29b-41d4-a716-446655440000' failed at 0xABCD with 'iron-gym'",
      );
      const b = svc.normalizeMessage(
        "Tenant '11111111-2222-3333-4444-555555555555' failed at 0x1234 with 'steel-gym'",
      );
      expect(a).toBe(b);
      expect(a).not.toMatch(/iron-gym|0xABCD/);
    });
  });

  describe('topFrame', () => {
    it('returns the first frame with line/col stripped', () => {
      const stack = [
        'Error: boom',
        '    at capture (/app/src/pos.ts:88:12)',
        '    at handler (/app/src/x.ts:10:1)',
      ].join('\n');
      const frame = svc.topFrame(stack);
      expect(frame).toContain('capture');
      expect(frame).not.toMatch(/:\d+:\d+/);
    });

    it('returns empty string for missing stack', () => {
      expect(svc.topFrame(null)).toBe('');
      expect(svc.topFrame(undefined)).toBe('');
    });
  });

  describe('fingerprint', () => {
    const base = {
      message: 'Payment failed: gateway timeout 504',
      source: ErrorSource.PAYMENT,
      module: 'pos',
      stack_trace: 'at capture (/app/pos.ts:88:1)',
    };

    it('is stable for equivalent errors with different variable data', () => {
      const fp1 = svc.fingerprint(base);
      const fp2 = svc.fingerprint({ ...base, message: 'Payment failed: gateway timeout 503' });
      expect(fp1).toBe(fp2);
    });

    it('differs when the source differs', () => {
      const fp1 = svc.fingerprint(base);
      const fp2 = svc.fingerprint({ ...base, source: ErrorSource.API });
      expect(fp1).not.toBe(fp2);
    });

    it('differs when the module differs', () => {
      const fp1 = svc.fingerprint(base);
      const fp2 = svc.fingerprint({ ...base, module: 'checkout' });
      expect(fp1).not.toBe(fp2);
    });

    it('returns a sha1 hex string', () => {
      expect(svc.fingerprint(base)).toMatch(/^[0-9a-f]{40}$/);
    });
  });
});
