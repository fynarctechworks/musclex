import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPassword } from '@/api/auth';
import { tokens } from '@/ui/tokens';

export default function ForgotPassword() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await forgotPassword(email.trim());
    } catch {
      // Deliberately swallowed. The response must not reveal whether an email
      // is registered — that turns this form into an account enumeration probe.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="flex-1 justify-center gap-4 p-6">
        <Text className="text-2xl font-semibold text-foreground">Reset password</Text>
        {sent ? (
          <Text className="text-sm text-muted-foreground">
            If that email has an account, a reset link is on its way.
          </Text>
        ) : (
          <>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@gym.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button onPress={onSubmit} disabled={busy || email.trim().length === 0}>
              <Text>{busy ? 'Sending…' : 'Send reset link'}</Text>
            </Button>
          </>
        )}
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          <Text>Back to sign in</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
