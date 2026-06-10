import { useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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
import { PHOTOS } from '../../src/assets/photos';
import { useAuth } from '../../src/auth/auth-store';
import { CountryPickerList } from '../../src/auth/CountryPickerList';
import {
  DEFAULT_COUNTRY,
  expectedDigitsFor,
  flagEmoji,
  isPhoneComplete,
  maxDigitsFor,
  type Country,
} from '../../src/data/countries';

/**
 * Welcome / sign-up — last screen of the pre-auth funnel (splash → onboarding →
 * here). A full-bleed masonry hero grid fades into the headline + "Get Started";
 * tapping it opens the phone-login sheet (global country picker → mobile number →
 * OTP). Real fitness photos from assets/photos.
 */

/** One masonry tile. */
const Tile = ({ h, source }: { h: number; source: ImageSourcePropType }) => (
  <View className="mb-sm overflow-hidden rounded-2xl bg-canvas-soft" style={{ height: h }}>
    <Image source={source} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
  </View>
);

export default function Welcome() {
  const router = useRouter();
  const theme = useThemeColors();
  const { height, width } = useWindowDimensions();
  const [authSheet, setAuthSheet] = useState(false);
  const [sheetView, setSheetView] = useState<'login' | 'country'>('login');

  // Phone-OTP login with a global dial-code picker.
  const requestOtp = useAuth((s) => s.requestOtp);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
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

  const fadeH = Math.round(height * 0.58);

  const closeSheet = () => {
    setAuthSheet(false);
    setSheetView('login');
  };

  // Legal pages live in (auth) so they're reachable pre-auth. Close the sheet
  // first — it's a Modal that would otherwise cover the pushed screen.
  const openLegal = (path: '/terms' | '/privacy') => {
    closeSheet();
    router.push(path);
  };

  const onContinue = async () => {
    if (!valid) return;
    setError(null);
    setLoading(true);
    const e164 = `${country.dial}${digits}`;
    try {
      await requestOtp(e164);
      closeSheet();
      router.push({ pathname: '/otp', params: { phone: e164 } });
    } catch {
      setError('Could not send the code. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View className="flex-1">
        {/* Full-bleed hero grid (fades into the canvas below) */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          <View className="flex-row gap-sm px-md pt-sm">
            <View className="flex-1">
              <Tile h={150} source={PHOTOS.workoutHome} />
              <Tile h={118} source={PHOTOS.hydration} />
              <Tile h={166} source={PHOTOS.cycling} />
              <Tile h={130} source={PHOTOS.meals} />
              <Tile h={150} source={PHOTOS.walking} />
            </View>
            <View className="flex-1" style={{ marginTop: 26 }}>
              <Tile h={166} source={PHOTOS.walking} />
              <Tile h={134} source={PHOTOS.homeGym} />
              <Tile h={118} source={PHOTOS.workoutHome} />
              <Tile h={150} source={PHOTOS.cycling} />
              <Tile h={140} source={PHOTOS.meals} />
            </View>
            <View className="flex-1">
              <Tile h={120} source={PHOTOS.meals} />
              <Tile h={160} source={PHOTOS.hydration} />
              <Tile h={128} source={PHOTOS.walking} />
              <Tile h={150} source={PHOTOS.homeGym} />
              <Tile h={140} source={PHOTOS.cycling} />
            </View>
          </View>
        </View>

        {/* Fade the lower half into the canvas so the copy reads cleanly. */}
        <Svg
          width={width}
          height={fadeH}
          style={{ position: 'absolute', left: 0, bottom: 0 }}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.canvas} stopOpacity={0} />
              <Stop offset="0.5" stopColor={theme.canvas} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.canvas} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={fadeH} fill="url(#fade)" />
        </Svg>

        {/* Headline + CTA, pinned to the bottom (safe-area handled by Screen) */}
        <View className="flex-1 justify-end px-md pb-lg">
          <Txt weight="600" className="text-ink" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1 }}>
            Welcome to MuscleX
            <Txt weight="600" style={{ fontSize: 30, color: theme.accent }}>
              .
            </Txt>
          </Txt>
          <Txt variant="body-md" className="mt-xs text-body">
            One best app for all things fitness
          </Txt>
          <Button title="Get Started" fullWidth className="mt-lg" onPress={() => setAuthSheet(true)} />
        </View>
      </View>

      <BottomSheet visible={authSheet} onClose={closeSheet}>
        {sheetView === 'login' ? (
          <Pressable onPress={dismissKeyboard} accessible={false}>
            <Txt variant="display-sm" weight="600" className="text-center text-ink">
              Login to MuscleX
            </Txt>
            <Txt variant="body-sm" className="mt-xs text-center text-body">
              Enter your mobile number to access your account.
            </Txt>

            <View
              className="mt-lg flex-row items-center rounded-xl border bg-surface"
              style={[{ height: 54 }, fieldStyle(!!error)]}
            >
              <Pressable
                onPress={() => setSheetView('country')}
                className="h-full flex-row items-center pl-md pr-sm"
              >
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

            <Button
              title="Continue"
              fullWidth
              className={`mt-lg ${valid ? '' : 'bg-hairline-strong opacity-100'}`}
              loading={loading}
              disabled={!valid}
              onPress={onContinue}
            />

            <View className="mt-md flex-row flex-wrap items-center justify-center">
              <Txt variant="caption" className="text-mute">
                By continuing, you agree to our{' '}
              </Txt>
              <Pressable onPress={() => openLegal('/terms')} hitSlop={8}>
                <Txt variant="caption" weight="500" style={{ color: theme.accent }}>
                  Terms of Service
                </Txt>
              </Pressable>
              <Txt variant="caption" className="text-mute">
                {' & '}
              </Txt>
              <Pressable onPress={() => openLegal('/privacy')} hitSlop={8}>
                <Txt variant="caption" weight="500" style={{ color: theme.accent }}>
                  Privacy Policy
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <>
            <View className="mb-md flex-row items-center">
              <Pressable onPress={() => setSheetView('login')} hitSlop={10} className="py-xs pr-sm">
                <Txt style={{ fontSize: 22 }} className="text-ink">
                  ←
                </Txt>
              </Pressable>
              <Txt variant="display-sm" weight="600" className="text-ink">
                Select country
              </Txt>
            </View>

            <CountryPickerList
              height={Math.min(height * 0.5, 360)}
              onSelect={(c) => {
                setCountry(c);
                setSheetView('login');
              }}
            />
          </>
        )}
      </BottomSheet>
    </Screen>
  );
}
