import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/api/auth';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { tokens } from '@/ui/tokens';

export default function SignIn() {
  const { signIn } = useSession();
  const toast = useToast();
  /**
   * Dev prefill, mirroring member-app's EXPO_PUBLIC_DEV_PHONE convention.
   *
   * Guarded by __DEV__ so it cannot ship in a release build. It exists because
   * typing into a controlled TextInput via automated input drops characters,
   * which makes scripted end-to-end sign-in unreliable.
   */
  const [email, setEmail] = React.useState(
    __DEV__ ? (process.env.EXPO_PUBLIC_DEV_EMAIL ?? '') : '',
  );
  const [password, setPassword] = React.useState(
    __DEV__ ? (process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '') : '',
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.kind === '2fa') {
        router.push({ pathname: '/(auth)/two-factor', params: { tempToken: result.tempToken } });
        return;
      }
      if (result.kind === 'workspace') {
        router.push({
          pathname: '/(auth)/workspace',
          params: {
            workspaces: JSON.stringify(result.workspaces),
            // Carried so the picker can authenticate its select call. Not
            // stored as a session: that would make the app briefly signed in
            // to the default gym and skip the picker entirely.
            ...(result.interim ? { interim: JSON.stringify(result.interim) } : {}),
          },
        });
        return;
      }
      await signIn(result.session);
      router.replace('/(tabs)');
    } catch (e) {
      // Surfaced inline rather than as a toast: a failed sign-in needs to stay
      // on screen while the user retypes, and a toast disappears.
      const message = e instanceof Error ? e.message : 'Could not sign in';
      setError(message);
      toast.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="gap-1 pb-6">
            <Text className="text-3xl font-semibold text-foreground">MuscleX Staff</Text>
            <Text className="text-sm text-muted-foreground">Sign in to your gym.</Text>
          </View>

          <View className="gap-4">
            <View className="gap-1">
              <Label><Text>Email</Text></Label>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@gym.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                testID="sign-in-email"
              />
            </View>

            <View className="gap-1">
              <Label><Text>Password</Text></Label>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
                testID="sign-in-password"
              />
            </View>

            {error ? (
              <Text className="text-sm text-destructive" testID="sign-in-error">{error}</Text>
            ) : null}

            <Button onPress={onSubmit} disabled={!canSubmit} testID="sign-in-submit">
              <Text>{busy ? 'Signing in…' : 'Sign in'}</Text>
            </Button>

            <Button variant="ghost" onPress={() => router.push('/(auth)/forgot-password')}>
              <Text>Forgot password?</Text>
            </Button>
          </View>

          {/*
            No "Create account" link. New gyms sign up on the web — the app is
            login-only by decision (plan §1), which also keeps Apple's IAP rules
            away from the signup funnel.
          */}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
