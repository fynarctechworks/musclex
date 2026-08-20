import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * QR CODES — adding somebody standing in front of you
 * ────────────────────────────────────────────────────────────────
 *
 * The payload is `musclex://u/<appUserId>`, the same deep link the app already
 * routes. An app_user id is not a secret — the profile it resolves to is a
 * name and two counts, and it 404s for anyone blocked — so there is nothing to
 * protect here beyond parsing it strictly.
 *
 * expo-camera is imported LAZILY, like every other native module in this app:
 * nothing loads unless somebody actually opens the scanner.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scanningSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Pull an app_user id out of a scanned string.
 *
 * Strict on purpose. A QR code is arbitrary text from a stranger's phone, and
 * the one thing we must not do is take whatever it says and put it in a URL —
 * so anything that is not our own scheme wrapping a real UUID is rejected
 * outright rather than "cleaned up".
 */
export function parseMemberCode(raw: string): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  // musclex://u/<id>, or the universal-link form on OUR domain.
  //
  // The host is pinned rather than accepting any https URL. Only the id
  // survives parsing either way, so a foreign host was never dangerous — but
  // "we accept any website's link" is not what this claims to do, and a rule
  // that is looser than its comment is one somebody will later rely on.
  const patterns = [
    /^musclex:\/\/u\/([0-9a-f-]{36})$/i,
    /^https?:\/\/(?:app\.)?musclex\.infynarc\.com\/u\/([0-9a-f-]{36})$/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && UUID.test(m[1])) return m[1].toLowerCase();
  }

  // A bare id, so a code pasted by hand still works.
  if (UUID.test(text)) return text.toLowerCase();

  return null;
}

export async function requestCameraPermission(): Promise<boolean> {
  if (!scanningSupported()) return false;
  try {
    const Camera = await import('expo-camera');
    const res = await Camera.Camera.requestCameraPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}
