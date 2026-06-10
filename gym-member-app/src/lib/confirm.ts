import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message?: string;
  /** Confirm-button label (native only; web uses the browser default). */
  confirmLabel?: string;
  /** Cancel-button label (native only). */
  cancelLabel?: string;
  /** Style the confirm action as destructive (native only). */
  destructive?: boolean;
}

/**
 * Cross-platform confirmation. On native this is `Alert.alert` with Cancel/Confirm
 * buttons; on web `Alert.alert`'s button callbacks never fire (react-native-web
 * doesn't render them), so we fall back to the browser's `window.confirm`. Resolves
 * `true` when the user confirms, `false` otherwise — so callers stay one shape.
 */
export function confirm({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(text)
        : true,
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Cross-platform single-button notice (web uses `window.alert`). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    }
    return;
  }
  Alert.alert(title, message);
}
