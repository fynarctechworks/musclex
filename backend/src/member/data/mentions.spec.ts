import { mentionedIds, toPlainText, toSegments } from './mentions';

/**
 * Comment text is written by members, so this parser is fed hostile input by
 * definition. The cases that matter are the ones where a marker is malformed,
 * nested, or names somebody the reader is not allowed to reach — none of which
 * may produce a link.
 */
const A = '59ab42bb-437a-4569-bc3f-d9795ce68a83';
const B = '5b6b21cc-cdd7-41ee-b9f4-b2749ce38ec8';
const all = (...ids: string[]) => new Set(ids);

describe('mentionedIds', () => {
  it('finds every id named', () => {
    expect(mentionedIds(`nice one @[Alice](${A}) and @[Bob](${B})`)).toEqual([A, B]);
  });

  it('counts the same person named twice as one mention', () => {
    expect(mentionedIds(`@[Alice](${A}) hey @[Alice](${A})`)).toEqual([A]);
  });

  it('finds nothing in ordinary text, including a bare @', () => {
    expect(mentionedIds('great run @alice')).toEqual([]);
    expect(mentionedIds('')).toEqual([]);
  });

  it('ignores a marker whose id is not a uuid', () => {
    expect(mentionedIds('@[Alice](not-a-uuid)')).toEqual([]);
  });
});

describe('toSegments', () => {
  it('splits text around a mention', () => {
    expect(toSegments(`nice one @[Alice](${A})!`, all(A))).toEqual([
      { type: 'text', value: 'nice one ' },
      { type: 'mention', id: A, name: 'Alice' },
      { type: 'text', value: '!' },
    ]);
  });

  it('renders a mention the reader may not reach as plain text', () => {
    // Naming somebody blocked must not produce a tappable link to them.
    expect(toSegments(`hey @[Blocked](${B})`, all(A))).toEqual([
      { type: 'text', value: 'hey @Blocked' },
    ]);
  });

  it('merges the text around a dropped mention into one segment', () => {
    expect(toSegments(`a @[X](${B}) b`, all())).toEqual([{ type: 'text', value: 'a @X b' }]);
  });

  it('leaves a plain comment as a single text segment', () => {
    expect(toSegments('just a normal comment', all(A))).toEqual([
      { type: 'text', value: 'just a normal comment' },
    ]);
  });

  it('handles a comment that is nothing but a mention', () => {
    expect(toSegments(`@[Alice](${A})`, all(A))).toEqual([
      { type: 'mention', id: A, name: 'Alice' },
    ]);
  });

  it('does not let a name smuggle brackets to nest a marker', () => {
    // `[` and `]` are excluded from names precisely so this cannot parse into
    // something other than what the author sees.
    const out = toSegments(`@[Ali[ce](${A})`, all(A));
    expect(out.every((s) => s.type === 'text')).toBe(true);
  });

  it('is not fooled by a marker missing its closing paren', () => {
    expect(toSegments(`@[Alice](${A}`, all(A))).toEqual([
      { type: 'text', value: `@[Alice](${A}` },
    ]);
  });

  it('keeps two mentions in order with their text between', () => {
    expect(toSegments(`@[A](${A}) vs @[B](${B})`, all(A, B)).map((s) => s.type)).toEqual([
      'mention', 'text', 'mention',
    ]);
  });
});

describe('toPlainText', () => {
  it('flattens markers to readable @names', () => {
    expect(toPlainText(`nice one @[Alice](${A})!`)).toBe('nice one @Alice!');
  });

  it('leaves a plain comment alone', () => {
    expect(toPlainText('no mentions here')).toBe('no mentions here');
  });

  it('does not double up an @ the author already typed', () => {
    expect(toPlainText(`@[@Alice](${A})`)).toBe('@Alice');
  });
});
