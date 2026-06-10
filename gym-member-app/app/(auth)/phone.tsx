import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  Button,
  Screen,
  Txt,
  dismissKeyboard,
  useFieldFocus,
  useThemeColors,
  webInputReset,
} from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { CountryPickerList } from '../../src/auth/CountryPickerList';
import {
  DEFAULT_COUNTRY,
  expectedDigitsFor,
  flagEmoji,
  isPhoneComplete,
  maxDigitsFor,
  type Country,
} from '../../src/data/countries';
import { useAuth } from '../../src/auth/auth-store';
import { isSupabaseConfigured } from '../../src/config';

export default function PhoneScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const requestOtp = useAuth((s) => s.requestOtp);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, '');
  const maxDigits = maxDigitsFor(country.code);
  const valid = isPhoneComplete(country.code, digits.length);
  const expectedDigits = expectedDigitsFor(country.code);
  // Guide the user once they start typing but the number isn't complete yet.
  const lengthHint =
    digits.length > 0 && !valid
      ? expectedDigits
        ? `Enter your ${expectedDigits}-digit mobile number`
        : 'Enter a valid mobile number'
      : null;
  const { focusProps, fieldStyle } = useFieldFocus();

  async function onContinue() {
    if (!valid) return;
    setError(null);
    setLoading(true);
    const e164 = `${country.dial}${digits}`;
    try {
      await requestOtp(e164);
      router.push({ pathname: '/otp', params: { phone: e164, dial: country.dial } });
    } catch {
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
        <Pressable onPress={dismissKeyboard} accessible={false}>
          <BackButton />
          <Txt variant="display-lg" weight="600" className="text-ink">
            {'What’s your number?'}
          </Txt>
          <Txt variant="body-md" className="mt-xs mb-xl text-body">
            {'We’ll text you a one-time code. Use the number registered at your gym.'}
          </Txt>

          <View
            className="flex-row items-center rounded-xl border bg-surface"
            style={[{ height: 54 }, fieldStyle(!!error)]}
          >
            <Pressable onPress={() => setPicker(true)} className="h-full flex-row items-center pl-md pr-sm">
              <Txt style={{ fontSize: 20 }}>{flagEmoji(country.code)}</Txt>
              <Txt weight="600" className="ml-xs text-ink" style={{ fontSize: 16 }}>
                {country.dial}
              </Txt>
              <Txt className="ml-xxs text-mute" style={{ fontSize: 11 }}>
                ▾
              </Txt>
            </Pressable>
            <View style={{ width: 1, height: 26, backgroundColor: theme.hairline }} />
            <TextInput
              style={[
                {
                  flex: 1,
                  height: '100%',
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: theme.ink,
                  fontFamily: 'Inter_400Regular',
                },
                webInputReset,
              ]}
              placeholder="Enter Mobile Number"
              placeholderTextColor={theme.mute}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus
              value={phone}
              onChangeText={setPhone}
              maxLength={maxDigits}
              returnKeyType="done"
              onSubmitEditing={onContinue}
              {...focusProps}
            />
          </View>
          {error ? (
            <Txt variant="caption" className="mt-xs text-error">
              {error}
            </Txt>
          ) : lengthHint ? (
            <Txt variant="caption" className="mt-xs text-mute">
              {lengthHint}
            </Txt>
          ) : null}
        </Pressable>

        <Button
          title="Send code"
          fullWidth
          loading={loading}
          className={valid ? '' : 'bg-hairline-strong opacity-100'}
          disabled={!valid}
          onPress={onContinue}
        />
      </KeyboardAvoidingView>

      <BottomSheet visible={picker} onClose={() => setPicker(false)} title="Select country">
        <CountryPickerList
          onSelect={(c) => {
            setCountry(c);
            setPicker(false);
          }}
        />
      </BottomSheet>
    </Screen>
  );
}
