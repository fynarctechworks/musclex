import { PiiScrubService } from './pii-scrub.service';

describe('PiiScrubService', () => {
  const svc = new PiiScrubService();

  it('redacts sensitive keys regardless of case/nesting', () => {
    const out = svc.scrub({
      amount: 1200,
      password: 'hunter2',
      Authorization: 'Bearer abc',
      nested: { apiKey: 'k', card_number: '4111111111111111', ok: 'keep' },
    }) as any;

    expect(out.amount).toBe(1200);
    expect(out.password).toBe('[REDACTED]');
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.nested.apiKey).toBe('[REDACTED]');
    expect(out.nested.card_number).toBe('[REDACTED]');
    expect(out.nested.ok).toBe('keep');
  });

  it('redacts bearer tokens and JWTs embedded in free-text strings', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123def456ghi789';
    const out = svc.scrub({
      note: `called with Bearer sk_live_0123456789abcdef and token ${jwt}`,
    }) as any;
    expect(out.note).not.toContain('sk_live_0123456789abcdef');
    expect(out.note).not.toContain(jwt);
    expect(out.note).toContain('[REDACTED');
  });

  it('returns undefined for nullish input', () => {
    expect(svc.scrub(null)).toBeUndefined();
    expect(svc.scrub(undefined)).toBeUndefined();
  });

  it('drops payloads larger than the 32KB cap', () => {
    const big = { blob: 'x'.repeat(40 * 1024) };
    const out = svc.scrub(big) as any;
    expect(out._dropped).toMatch(/32KB/);
  });

  it('handles arrays and primitives', () => {
    const out = svc.scrub({ items: [1, 'two', { token: 't', keep: 'y' }] }) as any;
    expect(out.items[0]).toBe(1);
    expect(out.items[1]).toBe('two');
    expect(out.items[2].token).toBe('[REDACTED]');
    expect(out.items[2].keep).toBe('y');
  });
});
