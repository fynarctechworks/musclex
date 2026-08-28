import { hydrate, kvGet, kvHas, kvRemove, kvSet } from '../kv';

/**
 * The contract these guard is that reads are SYNCHRONOUS. Drafts seed a text
 * box on its first render, so a value written a moment ago must be readable
 * immediately — not after the SQLite write resolves.
 */
describe('kv', () => {
  afterEach(() => {
    kvRemove('k1');
    kvRemove('k2');
  });

  it('reads back a value synchronously, without awaiting the write', () => {
    kvSet('k1', 'hello');
    // No await: a render path cannot wait for the disk.
    expect(kvGet('k1')).toBe('hello');
  });

  it('returns null for a key that was never set', () => {
    expect(kvGet('missing')).toBeNull();
  });

  it('distinguishes a cleared key from one holding an empty string', () => {
    kvSet('k1', '');
    expect(kvHas('k1')).toBe(true);
    kvRemove('k1');
    expect(kvHas('k1')).toBe(false);
  });

  it('overwrites rather than appending', () => {
    kvSet('k1', 'first');
    kvSet('k1', 'second');
    expect(kvGet('k1')).toBe('second');
  });

  it('keeps keys independent', () => {
    kvSet('k1', 'one');
    kvSet('k2', 'two');
    expect(kvGet('k1')).toBe('one');
    expect(kvGet('k2')).toBe('two');
  });

  it('hydrate resolves even when no store is available', async () => {
    // Under jest there is no SQLite and no localStorage; hydrate must still
    // settle, because startup awaits nothing else on it.
    await expect(hydrate()).resolves.toBeUndefined();
  });

  it('hydrate is idempotent', async () => {
    await hydrate();
    await hydrate();
    kvSet('k1', 'still works');
    expect(kvGet('k1')).toBe('still works');
  });
});
