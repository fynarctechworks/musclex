import { kvGet, kvHas, kvRemove, kvSet } from './kv';

/**
 * ────────────────────────────────────────────────────────────────
 * DRAFTS — half-typed text, kept across a tab switch
 * ────────────────────────────────────────────────────────────────
 *
 * The tab bar navigates with router.replace(), so switching tabs UNMOUNTS the
 * screen you were on: a comment typed halfway and abandoned to check something
 * else was gone on return, with no warning that it would be.
 *
 * Deliberately NOT the outbox store. That one is a queue of things owed to the
 * server, with attempt counts and idempotency keys; a draft is the opposite —
 * purely local, overwritten constantly, and worthless the moment it is sent.
 * Sharing the table would mean drafts competing with real writes for the
 * outbox's durability guarantees.
 *
 * Every operation is best-effort and silent on failure. Losing a draft is a
 * small disappointment; an exception thrown while somebody types is a crash.
 *
 * Durability comes from `kv`, which is backed by the SQLite database the
 * outbox already opens — so a draft now survives a force-quit, not just a tab
 * switch.
 */

const PREFIX = 'musclex.draft.';

/** Namespaced so one activity's comment box cannot read another's. */
export function draftKey(scope: string, id: string): string {
  return `${PREFIX}${scope}.${id}`;
}

export function readDraft(key: string): string {
  return kvGet(key) ?? '';
}

/** Whether anything is stored — distinguishes "cleared" from "stored as empty". */
export function hasDraft(key: string): boolean {
  return kvHas(key);
}

export function writeDraft(key: string, text: string): void {
  // An empty draft is an absent draft — otherwise clearing a box leaves a
  // stored empty string that outlives the thing it belonged to.
  if (!text) return clearDraft(key);
  kvSet(key, text);
}

export function clearDraft(key: string): void {
  kvRemove(key);
}
