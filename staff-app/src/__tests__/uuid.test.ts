import { uuidv4 } from '../lib/uuid';

const RFC4122_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv4', () => {
  it('matches the RFC 4122 v4 shape the backend validates against', () => {
    // The backend DTO uses @IsUUID(); a "close enough" id is rejected outright
    // ("client_event_id must be a UUID"), which is how this bug was found.
    for (let i = 0; i < 200; i++) expect(uuidv4()).toMatch(RFC4122_V4);
  });

  it('works without crypto.randomUUID — Hermes has no such function', () => {
    const original = globalThis.crypto;
    // @ts-expect-error deliberately removing the global for this test
    globalThis.crypto = undefined;
    try {
      expect(uuidv4()).toMatch(RFC4122_V4);
    } finally {
      globalThis.crypto = original;
    }
  });

  it('does not repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(uuidv4());
    expect(seen.size).toBe(2000);
  });
});
