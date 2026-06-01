import { Stack } from 'expo-router';
import { colors } from '../../src/design-system';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="choose-gym" />
      <Stack.Screen name="goal" />
    </Stack>
  );
}
