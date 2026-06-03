import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Txt } from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { useAuth } from '../../src/auth/auth-store';

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const requestOtp = useAuth((s) => s.requestOtp);
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    if (!phone) return;
    setError(null);
    setLoading(true);
    try {
      const next = await verifyOtp(phone, code.trim());
      if (next === 'choose-gym') router.push('/choose-gym');
      // 'authenticated' → AuthGate redirects to goal/app automatically.
    } catch {
      setError('That code didn’t work. Check it and try again.');
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
          <BackButton />
          <Txt variant="display-lg" weight="600" className="text-ink">
            Enter the code
          </Txt>
          <Txt variant="body-md" className="mt-xs mb-xl text-body">
            Sent to {phone}
          </Txt>

          <Input
            ref={inputRef}
            label="6-digit code"
            placeholder="123456"
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            value={code}
            onChangeText={setCode}
            error={error ?? undefined}
            onSubmitEditing={() => code.length >= 4 && onVerify()}
          />

          <Pressable
            className="mt-md"
            onPress={() => phone && requestOtp(phone)}
            hitSlop={8}
          >
            <Txt variant="body-sm" className="text-success-fg">
              Resend code
            </Txt>
          </Pressable>
        </View>

        <Button
          title="Verify"
          fullWidth
          loading={loading}
          disabled={code.length < 4}
          onPress={onVerify}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
