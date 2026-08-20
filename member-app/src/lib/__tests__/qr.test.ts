import { parseMemberCode } from '../qr';

/**
 * A QR code is arbitrary text from a stranger's phone. The important cases here
 * are the ones this must REFUSE — anything that is not our scheme wrapping a
 * real id gets rejected rather than tidied up into a URL we then follow.
 */
describe('parseMemberCode', () => {
  const id = '59ab42bb-437a-4569-bc3f-d9795ce68a83';

  it('reads our own deep link', () => {
    expect(parseMemberCode(`musclex://u/${id}`)).toBe(id);
  });

  it('reads the https form of the same link', () => {
    expect(parseMemberCode(`https://app.musclex.infynarc.com/u/${id}`)).toBe(id);
  });

  it('accepts a bare id, so a code can be pasted by hand', () => {
    expect(parseMemberCode(id)).toBe(id);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseMemberCode(`  MUSCLEX://U/${id.toUpperCase()}  `)).toBe(id);
  });

  it('refuses the same shape of link on somebody else\'s domain', () => {
    // Only the id ever survives parsing, so this was never dangerous — but the
    // rule should be as narrow as the comment above it says.
    expect(parseMemberCode(`https://evil.example.com/u/${id}`)).toBeNull();
  });

  it('refuses somebody else\'s scheme', () => {
    expect(parseMemberCode(`otherapp://u/${id}`)).toBeNull();
  });

  it('refuses a link to a different path', () => {
    expect(parseMemberCode(`musclex://settings/${id}`)).toBeNull();
  });

  it('refuses anything that is not a real id', () => {
    expect(parseMemberCode('musclex://u/not-a-uuid')).toBeNull();
    expect(parseMemberCode('musclex://u/../../admin')).toBeNull();
  });

  it('refuses plain junk rather than guessing', () => {
    expect(parseMemberCode('')).toBeNull();
    expect(parseMemberCode('hello')).toBeNull();
    expect(parseMemberCode('https://example.com/steal')).toBeNull();
  });
});
