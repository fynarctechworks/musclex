/**
 * Shared focus + keyboard behaviour for text fields, so every input across the
 * app gets the same branded treatment instead of a raw black browser outline.
 *
 * `useFieldFocus` tracks focus and returns:
 *   • focusProps  — spread onto a TextInput (onFocus/onBlur).
 *   • fieldStyle  — border + ring for the field's bordered wrapper (or the input
 *     itself). Resting → hairline; focused → branded accent border + soft ring;
 *     `error` always wins so validation stays visible. On web it also clears the
 *     default focus outline (the "black outline") — harmless on native.
 *
 * `dismissKeyboard` closes the soft keyboard and, on web, blurs the active input
 * so the field returns to its resting state on a background tap.
 */
import { useState } from 'react';
import {
  Keyboard,
  Platform,
  type GestureResponderEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useThemeColors } from './theme';

export function useFieldFocus() {
  const theme = useThemeColors();
  const [focused, setFocused] = useState(false);

  const focusProps: Pick<TextInputProps, 'onFocus' | 'onBlur'> = {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  /** Border + branded focus ring for the field wrapper. `error` takes priority. */
  const fieldStyle = (error?: boolean): ViewStyle => {
    const ring = error ? theme.errorSoft : theme.accentSoft;
    const borderColor = error ? theme.error : focused ? theme.accent : theme.hairlineStrong;
    const base: Record<string, unknown> = {
      borderColor,
      borderWidth: focused || error ? 1.5 : 1,
    };
    // react-native-web: replace the default focus outline with our branded ring.
    if (Platform.OS === 'web') {
      base.outlineStyle = 'none';
      base.boxShadow = focused ? `0 0 0 3px ${ring}` : 'none';
    }
    return base as ViewStyle;
  };

  return { focused, focusProps, fieldStyle };
}

/**
 * Clears the default browser focus outline on the inner input of a *composed*
 * field (one where the bordered wrapper — not the input — carries the focus
 * ring). Null on native. Spread into the TextInput's `style`.
 */
export const webInputReset: ViewStyle | null =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null;

/**
 * Close the keyboard and (on web) blur the active input, so a tap on the page
 * background returns the focused field to its resting state.
 *
 * Designed to be wired to a wrapping `<Pressable onPress={dismissKeyboard}>`.
 * On web, clicks bubble up from children — so a tap on the input itself would
 * otherwise reach here and blur the field (you couldn't type). We ignore taps
 * whose target is a form control and only dismiss on genuine background taps.
 */
export function dismissKeyboard(e?: GestureResponderEvent) {
  if (Platform.OS === 'web' && e) {
    const target = (e.nativeEvent as unknown as { target?: { tagName?: string } })?.target;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  }
  Keyboard.dismiss();
  if (Platform.OS === 'web') {
    const el = (globalThis as { document?: { activeElement?: { blur?: () => void } } }).document
      ?.activeElement;
    if (el && typeof el.blur === 'function') el.blur();
  }
}
