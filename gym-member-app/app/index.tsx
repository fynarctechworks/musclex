import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Logo, colors } from '../src/design-system';

/**
 * Splash — the first thing shown on cold launch: full primary-color field with the
 * MuscleX mark centred. It does NOT route itself; {@link AuthGate} holds redirects
 * for a short beat (splashElapsed) so this lingers, then sends the member on to
 * onboarding / welcome / home depending on auth + onboarding state.
 */
export default function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="dark" />
      <Logo height={120} variant="full" />
    </View>
  );
}
