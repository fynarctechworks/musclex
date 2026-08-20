import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * CONTACT MATCHING — hashed on the device, never uploaded
 * ────────────────────────────────────────────────────────────────
 *
 * Strava's fastest growth lever is uploading the phone's address book. We do
 * not do that. Numbers are normalised and hashed HERE, and only digests leave
 * the device, so no address book ever reaches our server, our logs, or our
 * database.
 *
 * The honest limit, stated plainly because the UI states it too: phone numbers
 * are a small, enumerable space and the salt ships in the app, so a determined
 * attacker holding the digests could reverse them. What hashing buys is real
 * but bounded — no plaintext contacts in transit or at rest. It is not
 * cryptographic privacy, and we should never imply that it is.
 *
 * Both modules are imported LAZILY, the same rule as every other native module
 * here: nothing loads unless the member actually chooses to match contacts.
 */

/** Must match PEOPLE_MATCH_SALT on the server. Not a secret — see above. */
const SALT = 'musclex.contacts.v1';

/** How many contacts we will hash in one go, matching the server's cap. */
const MAX = 2000;

export function contactsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * The last ten digits of a number.
 *
 * `phone` in our own database exists both with and without a country code —
 * the same person appears twice depending on how they signed up — so keying on
 * the last ten digits matches them either way instead of missing half.
 */
export function phoneTail(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export async function requestContactsPermission(): Promise<boolean> {
  if (!contactsSupported()) return false;
  try {
    const Contacts = await import('expo-contacts');
    const res = await Contacts.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * Read the address book, reduce it to hashed tails, and forget the rest.
 *
 * Returns digests only — the names and numbers never leave this function.
 */
export async function hashedContacts(): Promise<string[]> {
  if (!contactsSupported()) return [];
  const [Contacts, Crypto] = await Promise.all([
    import('expo-contacts'),
    import('expo-crypto'),
  ]);

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const tails = new Set<string>();
  for (const person of data) {
    for (const number of person.phoneNumbers ?? []) {
      const tail = phoneTail(number.number ?? '');
      if (tail) tails.add(tail);
      if (tails.size >= MAX) break;
    }
    if (tails.size >= MAX) break;
  }

  return Promise.all(
    [...tails].map((tail) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, tail + SALT),
    ),
  );
}
