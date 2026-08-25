import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyTwoFactor } from '@/api/auth';
import { useSession } from '@/auth/SessionProvider';
import { tokens } from '@/ui/tokens';

/**
 * Step 2 of sign-in. Accepts a TOTP code or a backup code — the backend's
 * verifyLogin handles both, so this must not restrict input to 6 digits.
 */
export default function TwoFactor() {
  const { tempToken } = useLocalSearchParams<{ tempToken: string }>();
  const { signIn } = useSession();
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit() {
    if (!tempToken) { setError('This sign-in attempt expired. Start again.'); return; }
    setBusy(true); setError(null);
    try {
      const result = await verifyTwoFactor(tempToken, code.trim());
      if (result.kind === 'workspace') {
        router.replace({
          pathname: '/(auth)/workspace',
          params: { workspaces: JSON.stringify(result.workspaces) },
        });
        return;
      }
      await signIn(result.session);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code was not accepted');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="flex-1 justify-center gap-4 p-6">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">Two-factor code</Text>
          <Text className="text-sm text-muted-foreground">
            Enter the code from your authenticator app, or a backup code.
          </Text>
        </View>

        <Input
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          // Not keyboardType="number-pad": backup codes are alphanumeric.
          autoCapitalize="characters"
          autoComplete="one-time-code"
          testID="two-factor-code"
        />

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        <Button onPress={onSubmit} disabled={busy || code.trim().length === 0}>
          <Text>{busy ? 'Verifying…' : 'Verify'}</Text>
        </Button>

        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          <Text>Back to sign in</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
