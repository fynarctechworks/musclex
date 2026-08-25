import { Alert, Linking, Platform } from 'react-native';

/**
 * Phone actions.
 *
 * Calling and WhatsApp are the two things a front-desk staffer does with a
 * member's number, and they are a genuine advantage over the web app — worth
 * wiring properly rather than showing a number to copy by hand.
 */

/** Strip formatting; keep a leading + for international numbers. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

async function open(url: string, unavailable: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) { Alert.alert(unavailable); return; }
    await Linking.openURL(url);
  } catch {
    Alert.alert(unavailable);
  }
}

export function callNumber(phone: string): Promise<void> {
  const n = normalisePhone(phone);
  // `telprompt:` lets iOS confirm before dialling; Android has no equivalent.
  const scheme = Platform.OS === 'ios' ? 'telprompt' : 'tel';
  return open(`${scheme}:${n}`, 'This device cannot place calls.');
}

export function messageOnWhatsApp(phone: string, text?: string): Promise<void> {
  const n = normalisePhone(phone).replace(/^\+/, '');
  const q = text ? `&text=${encodeURIComponent(text)}` : '';
  return open(`whatsapp://send?phone=${n}${q}`, 'WhatsApp is not installed.');
}

export function sendSms(phone: string, text?: string): Promise<void> {
  const n = normalisePhone(phone);
  // iOS uses & for the body separator, Android uses ?.
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const q = text ? `${sep}body=${encodeURIComponent(text)}` : '';
  return open(`sms:${n}${q}`, 'This device cannot send messages.');
}
