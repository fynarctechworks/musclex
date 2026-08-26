import { ScanGate, looksLikeMemberCode } from '../scan';

const STATIC = 'mxqr.v1.eyJtaWQiOiJhIn0.c2ln';
const DYNAMIC = 'mxqr.v1d.eyJtaWQiOiJhIn0.c2ln';

describe('ScanGate', () => {
  /** A controllable clock, so cooldowns are tested without waiting. */
  function gate(cooldown = 1000) {
    let t = 0;
    const g = new ScanGate(() => t, cooldown);
    return { g, advance: (ms: number) => { t += ms; } };
  }

  it('admits the first scan of a code', () => {
    const { g } = gate();
    expect(g.claim(STATIC)).toBe(true);
  });

  it('refuses a second code while one is still in flight', () => {
    const { g } = gate();
    g.claim(STATIC);
    expect(g.claim(DYNAMIC)).toBe(false);
  });

  it('refuses the SAME code repeatedly inside the cooldown', () => {
    // The real failure this prevents: a card left in frame firing ~10x/sec.
    const { g } = gate();
    g.claim(STATIC);
    g.release();
    for (let i = 0; i < 20; i++) expect(g.claim(STATIC)).toBe(false);
  });

  it('admits the same code again once the cooldown expires', () => {
    const { g, advance } = gate(1000);
    g.claim(STATIC);
    g.release();
    advance(1001);
    expect(g.claim(STATIC)).toBe(true);
  });

  it('does not make the next member wait out someone else cooldown', () => {
    // Cooldown is per-code, not global: a queue must keep moving.
    const { g } = gate();
    g.claim(STATIC);
    g.release();
    expect(g.claim(DYNAMIC)).toBe(true);
  });

  it('stays shut if release() is never called', () => {
    // Guards against a thrown handler wedging the scanner open.
    const { g, advance } = gate(1000);
    g.claim(STATIC);
    advance(10_000);
    expect(g.claim(DYNAMIC)).toBe(false);
  });

  it('lets a forgotten code be retried at once', () => {
    const { g } = gate(10_000);
    g.claim(STATIC);
    g.release();
    g.forget(STATIC);
    expect(g.claim(STATIC)).toBe(true);
  });

  it('does not grow without bound over a long shift', () => {
    const { g, advance } = gate(10);
    for (let i = 0; i < 500; i++) {
      g.claim(`mxqr.v1.code${i}`);
      g.release();
      advance(20);
    }
    // Nothing to assert on internals; the contract is that it still works.
    expect(g.claim('mxqr.v1.fresh')).toBe(true);
  });
});

describe('looksLikeMemberCode', () => {
  it.each([
    ['static signed token', STATIC],
    ['dynamic signed token', DYNAMIC],
    ['legacy raw uuid card', '3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
  ])('accepts a %s', (_label, code) => {
    expect(looksLikeMemberCode(code)).toBe(true);
  });

  it.each([
    ['a product barcode', '8901058000108'],
    ['a random url', 'https://example.com/hello'],
    ['empty', ''],
    ['whitespace', '   '],
    ['a near-miss prefix', 'mxqr.v2.abc.def'],
  ])('rejects %s', (_label, code) => {
    expect(looksLikeMemberCode(code)).toBe(false);
  });

  it('tolerates surrounding whitespace from the decoder', () => {
    expect(looksLikeMemberCode(`  ${STATIC}  `)).toBe(true);
  });
});
