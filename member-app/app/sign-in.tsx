import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { font, color, radius, space } from '../src/ui/theme';
import { useSession } from '../src/session';
import { digits, otpConfigured, requestOtp, type TenantChoice } from '../src/api/auth';

/**
 * Sign-in: phone, then the code, and only if the number belongs to more than
 * one gym, which one.
 *
 * Two steps rather than one form, because asking for a code before it has been
 * sent is the classic way to make people think a form is broken. The gym is
 * resolved from the phone number server-side, so a member never sees an id.
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

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      // In dev no SMS goes out, and the fixed bypass code works regardless —
      // so a failure here must not block the member from entering it.
      await requestOtp(phone).catch((e) => {
        if (realOtp) throw e;
      });
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
      const result = await signIn(phone, code, tenantId);
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

  const input = {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    color: color.t1,
    paddingHorizontal: space.lg,
    fontFamily: font,
    fontSize: 17,
  } as const;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: color.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          paddingTop: insets.top + space['3xl'],
          justifyContent: 'center',
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: space.md }}>
          <Row style={{ justifyContent: 'flex-start', gap: 3 }}>
            <Txt variant="display">MUSCLE</Txt>
            <Txt variant="display" tone="accent">X</Txt>
          </Row>
          <Txt variant="body" tone="t2" style={{ marginTop: space.sm }}>
            {step === 'phone'
              ? 'Sign in with the number your gym has on file.'
              : step === 'code'
                ? `We sent a code to ${phone}.`
                : 'Your number is registered at more than one gym.'}
          </Txt>
        </View>

        {error ? <Notice title="Could not sign in" body={error} onDismiss={() => setError(null)} /> : null}

        {step === 'phone' ? (
          <Card>
            <Txt variant="caption" tone="t3" style={{ marginBottom: space.sm }}>
              Mobile number
            </Txt>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
              placeholder="98765 43210"
              placeholderTextColor={color.t4}
              accessibilityLabel="Mobile number"
              style={input}
            />
            <View style={{ marginTop: space.lg }}>
              <Button title="Send code" onPress={sendCode} disabled={!phoneValid} loading={busy} />
            </View>
          </Card>
        ) : step === 'code' ? (
          <Card>
            <Txt variant="caption" tone="t3" style={{ marginBottom: space.sm }}>
              6-digit code
            </Txt>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={color.t4}
              accessibilityLabel="Verification code"
              style={[input, { letterSpacing: 8, textAlign: 'center', fontWeight: '700' }]}
            />
            <View style={{ marginTop: space.lg }}>
              <Button title="Sign in" onPress={() => verify()} disabled={code.length < 4} loading={busy} />
            </View>
            <Row style={{ marginTop: space.md }}>
              <Pressable
                onPress={() => { setStep('phone'); setCode(''); setError(null); }}
                accessibilityRole="button"
                accessibilityLabel="Change number"
              >
                <Txt variant="small" tone="t3">Change number</Txt>
              </Pressable>
              <Pressable onPress={sendCode} accessibilityRole="button" accessibilityLabel="Resend code">
                <Txt variant="small" tone="t3">Resend</Txt>
              </Pressable>
            </Row>
            {!realOtp ? (
              <Txt variant="caption" tone="t4" style={{ marginTop: space.md }}>
                Development mode: no SMS is sent.
              </Txt>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Txt variant="caption" tone="t3" style={{ marginBottom: space.md }}>
              Choose your gym
            </Txt>
            {choices.map((c) => (
              <Pressable
                key={c.tenantId}
                onPress={() => verify(c.tenantId)}
                accessibilityRole="button"
                accessibilityLabel={`Sign in to ${c.gymName}`}
                style={{
                  height: 52,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: color.line,
                  backgroundColor: color.surface2,
                  paddingHorizontal: space.lg,
                  justifyContent: 'center',
                  marginBottom: space.sm,
                }}
              >
                <Row>
                  <Txt variant="bodyStrong">{c.gymName}</Txt>
                  <Txt variant="body" tone="t3">›</Txt>
                </Row>
              </Pressable>
            ))}
          </Card>
        )}

        <Txt variant="caption" tone="t4" style={{ textAlign: 'center' }}>
          Your gym issues your account. If your number is not recognised, ask at the front desk.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
