import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, Txt } from '../../src/design-system';
import { useAuth } from '../../src/auth/auth-store';
import { isSupabaseConfigured } from '../../src/config';

/** Normalize to E.164-ish: keep leading +, strip spaces/dashes. Default +91 (India-first). */
function normalize(raw: string): string {
  const trimmed = raw.replace(/[^\d+]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.length === 10) return `+91${trimmed}`;
  return `+${trimmed}`;
}

export default function PhoneScreen() {
  const router = useRouter();
  const requestOtp = useAuth((s) => s.requestOtp);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = normalize(phone).length >= 12;

  async function onContinue() {
    setError(null);
    setLoading(true);
    const e164 = normalize(phone);
    try {
      await requestOtp(e164);
      router.push({ pathname: '/otp', params: { phone: e164 } });
    } catch (err) {
      setError(
        isSupabaseConfigured()
          ? 'Could not send the code. Check the number and try again.'
          : 'OTP provider not configured (set Supabase env vars).',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-between pt-2xl pb-md"
      >
        <View>
          <Pressable onPress={() => router.back()} hitSlop={12} className="mb-lg">
            <Txt variant="body-sm" className="text-body">{'←  Back'}</Txt>
          </Pressable>
          <Txt variant="display-lg" weight="600" className="text-ink">
            {'What’s your number?'}
          </Txt>
          <Txt variant="body-md" className="mt-xs mb-xl text-body">
            {'We’ll text you a one-time code. Use the number registered at your gym.'}
          </Txt>

          <Input
            label="Phone number"
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            autoFocus
            value={phone}
            onChangeText={setPhone}
            error={error ?? undefined}
            returnKeyType="done"
            onSubmitEditing={() => valid && onContinue()}
          />
        </View>

        <Button
          title="Send code"
          fullWidth
          loading={loading}
          disabled={!valid}
          onPress={onContinue}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
