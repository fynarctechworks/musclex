/**
 * Expo push transport — the one place that talks to exp.host.
 *
 * Extracted so the member path and the staff path cannot drift on the details
 * that actually decide whether a notification lands: the `ExponentPushToken[`
 * prefix filter, the 100-per-request chunking Expo enforces, and reading the
 * per-ticket errors back out. A send that returns HTTP 200 has not necessarily
 * delivered anything — Expo reports dead handsets inside the ticket body.
 */

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

export interface ExpoSendResult {
  /** Tokens Expo accepted for delivery. */
  sent: number;
  /**
   * Tokens Expo says will never deliver again (`DeviceNotRegistered`) — the
   * app was uninstalled or the token rotated. Callers should delete these;
   * left in place they are retried forever on every future send.
   */
  deadTokens: string[];
}

/** Expo rejects requests larger than 100 messages. */
const CHUNK = 100;

export function isExpoToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[');
}

export async function sendViaExpo(messages: ExpoMessage[]): Promise<ExpoSendResult> {
  const valid = messages.filter((m) => isExpoToken(m.to));
  if (valid.length === 0) return { sent: 0, deadTokens: [] };

  const deadTokens: string[] = [];
  let sent = 0;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const batch = valid.slice(i, i + CHUNK);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      throw new Error(`Expo push API ${res.status}: ${err}`);
    }

    // A malformed or empty ticket body must not fail a send that Expo already
    // accepted — the messages are gone either way, and throwing here would
    // make the caller retry a delivery that already happened.
    let tickets: Array<{ status?: string; details?: { error?: string } }> = [];
    try {
      const json = (await res.json()) as {
        data?: Array<{ status?: string; details?: { error?: string } }>;
      } | null;
      tickets = json?.data ?? [];
    } catch {
      tickets = [];
    }

    batch.forEach((msg, idx) => {
      const ticket = tickets[idx];
      // No ticket back means Expo did not report on it either way; count it as
      // sent rather than silently dropping a delivery that probably happened.
      if (!ticket || ticket.status !== 'error') {
        sent += 1;
        return;
      }
      if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(msg.to);
    });
  }

  return { sent, deadTokens };
}
