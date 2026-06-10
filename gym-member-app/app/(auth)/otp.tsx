import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Screen,
  Txt,
  dismissKeyboard,
  radius,
  useThemeColors,
} from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { useAuth } from '../../src/auth/auth-store';
import { generateDevOtp, isDevOtpEnabled } from '../../src/config';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * Mask the phone for display: "+91 XXXXXXX648" — keep the dial code and the last
 * three digits, hide the rest. Uses the dial param when available so we know
 * exactly where the country code ends; otherwise falls back to a generic mask.
 */
function maskPhone(e164?: string, dial?: string): string {
  if (!e164) return '';
  if (dial && e164.startsWith(dial)) {
    const nat = e164.slice(dial.length).replace(/\D/g, '');
    if (nat.length <= 3) return `${dial} ${nat}`;
    return `${dial} ${'X'.repeat(nat.length - 3)}${nat.slice(-3)}`;
  }
  const digits = e164.replace(/\D/g, '');
  if (digits.length <= 3) return e164;
  return `+${'X'.repeat(digits.length - 3)}${digits.slice(-3)}`;
}

export default function OtpScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { phone, dial } = useLocalSearchParams<{ phone: string; dial?: string }>();
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const requestOtp = useAuth((s) => s.requestOtp);
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState('');
  // ⚠️ DEV-ONLY: the code shown on-screen for the tester to type (no SMS).
  // Generated once per visit; regenerated on resend. Empty in production.
  const [devCode, setDevCode] = useState(() =>
    isDevOtpEnabled() ? generateDevOtp() : '',
  );
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  // Countdown ticks once a second until it hits zero, then the resend link unlocks.
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  // Make the code field active on arrival: `autoFocus` alone is unreliable during
  // the slide-in transition (native + web), so explicitly focus once the screen
  // has settled. This raises the keyboard and lights the first box immediately.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, []);

  async function onVerify(value = code) {
    if (!phone || value.length < OTP_LENGTH || loading) return;
    setError(null);
    setLoading(true);
    try {
      const next = await verifyOtp(phone, value.trim());
      if (next === 'choose-gym') router.push('/choose-gym');
      // 'authenticated' → AuthGate redirects to goal/app automatically.
    } catch {
      setError('That code didn’t work. Check it and try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (seconds > 0 || !phone) return;
    setError(null);
    setCode('');
    setSeconds(RESEND_SECONDS);
    if (isDevOtpEnabled()) setDevCode(generateDevOtp());
    try {
      await requestOtp(phone);
    } catch {
      setError('Could not resend the code. Try again in a moment.');
    }
  }

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === OTP_LENGTH) onVerify(digits);
  }

  const display = isDevOtpEnabled()
    ? `Dev mode — enter ${devCode} (no SMS sent)`
    : `We sent a 6-digit OTP to ${maskPhone(phone, dial)}`;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-between pt-2xl pb-md"
      >
        <Pressable onPress={dismissKeyboard} accessible={false}>
          <BackButton />
          <Txt variant="display-lg" weight="600" className="text-ink">
            Verify OTP
          </Txt>
          <Txt variant="body-md" className="mt-xs mb-xl text-body">
            {display}
          </Txt>

          {/* Segmented 6-box code field. A single transparent input sits over the
              boxes and owns the caret/keyboard; the boxes are display-only. */}
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View className="flex-row" style={{ gap: 10 }}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                const char = code[i] ?? '';
                const isFilled = char !== '';
                const isActive = focused && i === code.length && !error;
                return (
                  <View
                    key={i}
                    className="flex-1 items-center justify-center"
                    style={{
                      height: 56,
                      borderRadius: radius.lg,
                      borderWidth: isActive ? 2 : 1.5,
                      borderColor: error
                        ? theme.error
                        : isFilled || isActive
                          ? theme.primary
                          : theme.hairline,
                      backgroundColor: isFilled ? theme.accentSoft : theme.surface,
                    }}
                  >
                    <Txt weight="600" className="text-ink" style={{ fontSize: 22 }}>
                      {char}
                    </Txt>
                  </View>
                );
              })}
            </View>

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              autoFocus
              maxLength={OTP_LENGTH}
              caretHidden
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 56, opacity: 0 }}
            />
          </Pressable>

          {error ? (
            <Txt variant="caption" className="mt-sm text-error">
              {error}
            </Txt>
          ) : null}

          <View className="mt-lg flex-row items-center">
            <Txt variant="body-sm" className="text-mute">
              OTP not received?{' '}
            </Txt>
            <Pressable onPress={onResend} disabled={seconds > 0} hitSlop={8}>
              <Txt
                variant="body-sm"
                weight="600"
                style={{
                  textDecorationLine: 'underline',
                  color: seconds > 0 ? theme.mute : theme.ink,
                }}
              >
                {seconds > 0 ? `Resend code in (${seconds}s)` : 'Resend code'}
              </Txt>
            </Pressable>
          </View>
        </Pressable>

        <Button
          title="Verify OTP"
          fullWidth
          loading={loading}
          className={code.length === OTP_LENGTH ? '' : 'bg-hairline-strong opacity-100'}
          disabled={code.length < OTP_LENGTH}
          onPress={() => onVerify()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
