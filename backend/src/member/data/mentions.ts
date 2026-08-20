/**
 * ────────────────────────────────────────────────────────────────
 * MENTIONS — parsing @[Name](id) out of a comment
 * ────────────────────────────────────────────────────────────────
 *
 * The wire format is `@[Display Name](uuid)`. It survives a round trip through
 * a plain text column, needs no offset bookkeeping, and — the reason it is this
 * and not offsets — cannot drift: if the body is edited, a stale offset would
 * silently point at the wrong word, whereas a marker either exists or does not.
 *
 * The server hands the client SEGMENTS rather than the raw markers, so nothing
 * downstream has to re-implement this parse. One parser, one format.
 */

export interface MentionSegment {
  type: 'mention';
  id: string;
  name: string;
}

export interface TextSegment {
  type: 'text';
  value: string;
}

export type Segment = TextSegment | MentionSegment;

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
/** `@[Name](uuid)`. The name may not contain brackets, so it cannot nest. */
const MARKER = new RegExp(`@\\[([^\\][]{1,60})\\]\\((${UUID})\\)`, 'g');

/** Every app_user id named in the text, de-duplicated, in order of appearance. */
export function mentionedIds(body: string): string[] {
  const out: string[] = [];
  for (const m of (body ?? '').matchAll(MARKER)) {
    const id = m[2].toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Split a body into text and mention segments.
 *
 * `allowed` is the set of ids that survived validation. A marker for anyone
 * else — blocked, deleted, or simply invented by a hand-written request — is
 * rendered as its plain name, so a comment never shows a link to somebody the
 * reader is not allowed to reach.
 */
export function toSegments(body: string, allowed: ReadonlySet<string>): Segment[] {
  const text = body ?? '';
  const out: Segment[] = [];
  let last = 0;

  const push = (value: string) => {
    if (!value) return;
    const prev = out[out.length - 1];
    // Merge adjacent text so a dropped mention does not leave the client with
    // three fragments where one word belongs.
    if (prev && prev.type === 'text') prev.value += value;
    else out.push({ type: 'text', value });
  };

  for (const m of text.matchAll(MARKER)) {
    const [marker, name, rawId] = m;
    const at = m.index ?? 0;
    push(text.slice(last, at));
    const id = rawId.toLowerCase();
    if (allowed.has(id)) out.push({ type: 'mention', id, name });
    else push(name.startsWith('@') ? name : `@${name}`);
    last = at + marker.length;
  }
  push(text.slice(last));

  return out;
}

/**
 * The body as a human reads it, with markers flattened to plain @names.
 *
 * This is what gets stored in `body` and what any surface without segment
 * rendering — a notification, a push payload, a plain-text export — shows.
 */
export function toPlainText(body: string): string {
  return (body ?? '').replace(MARKER, (_m, name: string) =>
    name.startsWith('@') ? name : `@${name}`,
  );
}
