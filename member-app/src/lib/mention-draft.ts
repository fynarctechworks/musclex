import type { Person } from '../api/types';

/**
 * ────────────────────────────────────────────────────────────────
 * MENTION DRAFTING — turning what someone types into the wire format
 * ────────────────────────────────────────────────────────────────
 *
 * The member types "@ali"; the server needs "@[Alice](uuid)". This is the
 * translation, kept pure so the fiddly bit — where the @ starts and how much
 * of it to replace — is testable without a keyboard.
 */

/** The @word the caret is currently inside, if any. */
export function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;

  // Must start the text or follow whitespace, or "email@host" opens a picker.
  const before = at === 0 ? ' ' : upto[at - 1];
  if (!/\s/.test(before)) return null;

  const query = upto.slice(at + 1);
  // A space ends it: "@alice went far" is not a four-word name.
  if (/\s/.test(query)) return null;
  if (query.length > 30) return null;

  return { query, start: at };
}

/** People whose name matches what has been typed so far. */
export function matchPeople(people: Person[], query: string, limit = 5): Person[] {
  const q = query.trim().toLowerCase();
  const named = people.filter((p) => p.name);
  if (!q) return named.slice(0, limit);
  return named
    .filter((p) => (p.name as string).toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * Replace the @word being typed with a full marker.
 *
 * Returns the new text and where the caret should land — after the marker and
 * a trailing space, so the member keeps typing a sentence rather than landing
 * inside a uuid.
 */
export function applyMention(
  text: string,
  start: number,
  caret: number,
  person: Person,
): { text: string; caret: number } {
  const marker = `@[${(person.name ?? 'Someone').replace(/[[\]]/g, '')}](${person.id}) `;
  const next = text.slice(0, start) + marker + text.slice(caret);
  return { text: next, caret: start + marker.length };
}
