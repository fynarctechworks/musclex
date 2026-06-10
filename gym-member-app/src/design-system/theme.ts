/**
 * Reactive theme access for the SVG/chart/StatusBar code that can't use NativeWind
 * className utilities. Returns the active palette and re-renders the consumer when
 * the member toggles light/dark, because it reads NativeWind's `colorScheme`.
 *
 * Usage:
 *   const theme = useThemeColors();
 *   <Icon color={theme.body} />
 *
 * Never `import { colors }` into reactive UI — that binding is static (light) and
 * won't follow the toggle. Use this hook instead.
 */
import { useColorScheme } from 'nativewind';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}

/** True when the dark theme is active. Handy for StatusBar bar-style, etc. */
export function useIsDark(): boolean {
  return useColorScheme().colorScheme === 'dark';
}
