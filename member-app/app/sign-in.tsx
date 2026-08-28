import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Label, Row, Txt } from '../src/ui';
import { Input } from '@/components/ui/input';
import { Notice } from '../src/ui/Notice';
import { useSession } from '../src/session';
import { digits, otpConfigured, requestOtp, type TenantChoice } from '../src/api/auth';
import { LogoMark } from '../src/ui/Logo';

/**
 * ────────────────────────────────────────────────────────────────
 * SIGN IN
 * ────────────────────────────────────────────────────────────────
 *
 * Phone, then the code, and only if the number belongs to more than one gym,
 * which one. Two steps rather than one form, because asking for a code before
 * it has been sent is the classic way to make people think a form is broken.
 *
 * Rebuilt on the design system. The previous version accumulated three problems
 * that together made the primary action look like it undid itself:
 *
 *   - its placeholder was "000000", the same as the dev bypass code, so an
 *     EMPTY field looked like a filled one
 *   - the primary was disabled below four characters and said nothing about
 *     why, so it read as a dead button
 *   - "Change number" sat directly beneath it, and resets to the phone step —
 *     so a near-miss on that dead-looking button threw the member back to the
 *     start, which is indistinguishable from sign-in failing
 *
 * The fix is structural rather than cosmetic: there is one action per step, the
 * secondary controls are nowhere near it, and the button is never disabled in a
 * way that leaves a member guessing.
 */

type Step = 'phone' | 'code' | 'gym';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const realOtp = otpConfigured();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(realOtp ? '' : (process.env.EXPO_PUBLIC_DEV_PHONE ?? ''));
  const [code, setCode] = useState('');
  const [choices, setChoices] = useState<TenantChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneValid = digits(phone).length >= 10;
  const codeValid = code.trim().length >= 4;

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      // In dev no SMS goes out and the fixed bypass code works regardless, so a
      // failure here must not block the member from entering it.
      await requestOtp(phone).catch((e) => {
        if (realOtp) throw e;
      });
      // Prefilled in dev for the same reason the phone number is: the bypass
      // code is fixed, and typing it by hand teaches nothing.
      if (!realOtp) setCode(process.env.EXPO_PUBLIC_DEV_OTP ?? '000000');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(tenantId?: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await signIn(phone, code.trim(), tenantId);
      // A signed-in result needs nothing here: the session flips and the gate
      // in _layout moves us. Only the multi-gym case has another question.
      if (result.status === 'choose-gym') {
        setChoices(result.choices);
        setStep('gym');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="px-4 gap-5 flex-grow justify-center"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled">
        {/*
          ── Brand ────────────────────────────────────────────────────────
          Centred, with real room around it, matching staff-app's front door
          so the two apps read as one product. The mark carries the only red
          on the screen; the primary button takes its colour from the design
          system, not from here.

          Spacing is `style` rather than gap-* classes deliberately. staff-app
          documented that gap-5/pb-9 silently render as NO spacing on device
          while other classes on the same element apply — explicit values are
          unambiguous, and this is the screen where a collapsed header would
          be most visible.
        */}
        <View className="items-center" style={{ gap: 20, paddingBottom: 12 }}>
          {/* The mark alone. It IS the wordmark's logo — setting MUSCLEX in
              type underneath it said the same name twice, once as a drawing
              and once as text. */}
          <LogoMark height={52} />
          <Txt variant="body" tone="t2" className="text-center">
            {step === 'phone'
              ? 'Enter your mobile number to get started.'
              : step === 'code'
                ? `We sent a code to ${phone}.`
                : 'Your number is registered at more than one gym.'}
          </Txt>
        </View>

        {error ? (
          <Notice tone="error" title="Could not sign in" body={error} onDismiss={() => setError(null)} />
        ) : null}

        {step === 'phone' ? (
          <Card className="gap-3 p-5">
            <View className="gap-1.5">
              <Label>Mobile number</Label>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
                placeholder="98765 43210"
                accessibilityLabel="Mobile number"
                returnKeyType="done"
                onSubmitEditing={() => phoneValid && sendCode()}
              />
            </View>
            <Button title="Send code" onPress={sendCode} disabled={!phoneValid} loading={busy} />
            {!phoneValid ? (
              <Txt variant="caption" tone="t3" className="text-center">
                Enter your 10-digit number to continue.
              </Txt>
            ) : null}
          </Card>
        ) : step === 'code' ? (
          <>
            <Card className="gap-3 p-5">
              <View className="gap-1.5">
                <Label>6-digit code</Label>
                <Input
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={6}
                  // NOT "000000": that is the dev bypass code, and a placeholder
                  // identical to a valid value makes an empty field look full.
                  placeholder="Enter the code"
                  accessibilityLabel="Verification code"
                  returnKeyType="done"
                  className="text-center text-lg"
                  onSubmitEditing={() => codeValid && verify()}
                />
              </View>
              <Button title="Sign in" onPress={() => verify()} disabled={!codeValid} loading={busy} />
              {!codeValid ? (
                <Txt variant="caption" tone="t3" className="text-center">
                  Enter the code to continue.
                </Txt>
              ) : null}
            </Card>

            {/*
              Well clear of the primary. These used to sit one Row beneath it,
              and "Change number" resets to the phone step — so a near-miss on a
              disabled Sign in looked exactly like sign-in throwing you back to
              the start.
            */}
            <Row className="px-2">
              <Pressable
                onPress={() => {
                  setStep('phone');
                  setCode('');
                  setError(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Change number"
                hitSlop={12}>
                <Txt variant="small" tone="t3">
                  Change number
                </Txt>
              </Pressable>
              <Pressable
                onPress={sendCode}
                accessibilityRole="button"
                accessibilityLabel="Send a new code"
                hitSlop={12}>
                <Txt variant="small" tone="t3">
                  Resend
                </Txt>
              </Pressable>
            </Row>

            {!realOtp ? (
              <Txt variant="caption" tone="t4" className="text-center">
                Development mode: no SMS is sent.
              </Txt>
            ) : null}
          </>
        ) : (
          <Card className="gap-3 p-5">
            <Label>Choose your gym</Label>
            {choices.map((c) => (
              <Button
                key={c.tenantId}
                title={c.gymName}
                variant="secondary"
                loading={busy}
                onPress={() => verify(c.tenantId)}
              />
            ))}
          </Card>
        )}

        <Txt variant="caption" tone="t3" className="text-center">
          New here? An account is created for you. If your gym uses MuscleX, use the number they
          have on file to link it automatically.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
