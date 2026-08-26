import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/api/auth';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * SIGN IN
 * ────────────────────────────────────────────────────────────────
 *
 * The first screen anyone sees, and until now the least considered: a bare
 * title on a flat background with two unadorned fields. Three things carry the
 * upgrade, and none of them is decoration.
 *
 *  - The MARK. The app had no brand on its own front door. A logo is also the
 *    fastest way for someone holding a shared gym phone to know which app they
 *    have opened.
 *  - A CARD. The form sits on white over the #fafafa canvas with a hairline
 *    and a soft drop — the same card pattern the rest of the app uses. Fields
 *    floating on flat white read as an unfinished form.
 *  - Room. Generous spacing above the fold is most of what separates a
 *    considered screen from a cramped one.
 *
 * Red appears ONLY in the logo. The primary action stays ink, per the design
 * system: this app takes payments and deletes members, so red has to keep
 * meaning "destructive" everywhere else.
 *
 * ── Why the spacing is `style` and not `gap-*` ──────────────────────────────
 *
 * UNRESOLVED, and worth knowing before you "tidy" this back into classes.
 *
 * With `className="items-center gap-5 pb-9"` this header renders with NO
 * vertical spacing at all on device — the logo overlaps the title and the
 * subtitle overlaps the card. The same element with `style={{ gap: 20,
 * paddingBottom: 36 }}` is correct. Confirmed by A/B on the simulator, and it
 * survives `expo start --clear`, so it is not a stale Metro cache.
 *
 * Other classes on the same elements DO apply — `rounded-xl`, `border`,
 * `bg-card`, `items-center` all work — and `gap-2`/`gap-3` work elsewhere in
 * the app, where they are used 50+ times. `gap-5` and `pb-9` are used almost
 * nowhere else, which points at class generation rather than at layout, but I
 * could not prove it. Explicit values are used here because they are
 * unambiguous, not because the classes are wrong in principle.
 *
 * If you add a Tailwind spacing class this app does not already use heavily,
 * LOOK AT IT ON A DEVICE. It can silently do nothing.
 */
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
  const [reveal, setReveal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const passwordRef = React.useRef<React.ComponentRef<typeof Input>>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          /*
            Without this, the first tap while the keyboard is open only dismisses
            it — so "Sign in" needs pressing twice, every time, which reads as a
            broken button rather than as keyboard behaviour.
          */
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* ── Brand ─────────────────────────────────────────────────── */}
          <View className="items-center" style={{ gap: 20, paddingBottom: 36 }}>
            <Image
              source={require('../../assets/logo-mark.png')}
              style={{ width: 132, height: 38 }}
              resizeMode="contain"
              // The wordmark beneath already says MuscleX Staff, so announcing
              // the image too would read the brand twice to a screen reader.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              accessibilityIgnoresInvertColors
            />
            <View className="items-center" style={{ gap: 6 }}>
              <Text
                role="heading"
                className="text-[26px] font-semibold tracking-tight text-foreground">
                MuscleX Staff
              </Text>
              <Text className="text-[15px] text-muted-foreground">Sign in to your gym.</Text>
            </View>
          </View>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <View
            className="rounded-xl border border-border bg-card"
            style={{
              gap: 20,
              padding: 24,
              // A hairline alone leaves a card looking like a drawn box; on a
              // light canvas it needs a drop as well to read as a surface.
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}>
            <View style={{ gap: 8 }}>
              <Label nativeID="email-label"><Text>Email</Text></Label>
              <Input
                aria-labelledby="email-label"
                value={email}
                onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                placeholder="you@gym.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={{ height: 48 }}
                testID="sign-in-email"
              />
            </View>

            <View style={{ gap: 8 }}>
              <Label nativeID="password-label"><Text>Password</Text></Label>
              <View className="justify-center">
                <Input
                  ref={passwordRef}
                  aria-labelledby="password-label"
                  value={password}
                  onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
                  placeholder="••••••••"
                  secureTextEntry={!reveal}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  // Room for the reveal control, so a long password never runs
                  // underneath it.
                  style={{ height: 48, paddingRight: 48 }}
                  testID="sign-in-password"
                />
                {/*
                  A reveal toggle is close to mandatory here: this is a shared
                  handset, often held one-handed with chalk or sweat on it, and
                  a mistyped password that cannot be checked costs a lockout
                  after five tries.
                */}
                <Pressable
                  onPress={() => setReveal((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
                  accessibilityState={{ selected: reveal }}
                  // 44pt target on a 12pt glyph.
                  hitSlop={12}
                  // Explicit 44x44, not `h-11 w-11`: the accessibility tree
                  // reported this control as 18pt WIDE with the classes, i.e.
                  // the icon's own width — the same class problem described at
                  // the top of this file, and here it is a touch target, not
                  // just spacing.
                  className="absolute items-center justify-center"
                  style={{ right: 4, width: 44, height: 44 }}
                  testID="sign-in-reveal">
                  {reveal ? (
                    <EyeOff size={18} color={tokens.mutedForeground} />
                  ) : (
                    <Eye size={18} color={tokens.mutedForeground} />
                  )}
                </Pressable>
              </View>
            </View>

            {error ? (
              // Beside the fields it refers to, not at the top of the screen,
              // and with an icon so it does not depend on colour alone.
              <View
                className="flex-row items-start rounded-md border border-destructive/25 bg-destructive/5"
                style={{ gap: 8, padding: 12 }}
                accessibilityLiveRegion="polite"
                testID="sign-in-error">
                <TriangleAlert size={15} color={tokens.destructive} style={{ marginTop: 1 }} />
                <Text className="flex-1 text-[13px] leading-5 text-destructive">{error}</Text>
              </View>
            ) : null}

            <Button
              onPress={onSubmit}
              disabled={!canSubmit}
              // 48pt. With `className="h-12"` this rendered at 36 — under the
              // 44pt minimum, on the screen's primary action.
              style={{ height: 48 }}
              accessibilityLabel="Sign in"
              testID="sign-in-submit">
              {busy ? (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  {/* A spinner, not just changed words: on a slow gym network
                      the wait is long enough that static text reads as a
                      button that did not respond. */}
                  <ActivityIndicator size="small" color={tokens.background} />
                  <Text>Signing in…</Text>
                </View>
              ) : (
                <Text>Sign in</Text>
              )}
            </Button>

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              className="items-center justify-center"
              style={{ height: 44 }}
              testID="sign-in-forgot">
              <Text className="text-[14px] font-medium text-muted-foreground">
                Forgot password?
              </Text>
            </Pressable>
          </View>

          {/*
            No "Create account" link. New gyms sign up on the web — the app is
            login-only by decision (plan §1), which also keeps Apple's IAP rules
            away from the signup funnel.

            This line replaces it, and earns its place: "how do I get an
            account" is the single most common thing support is asked, and the
            answer is never "here".
          */}
          <Text className="text-center text-[13px] leading-5 text-muted-foreground"
            style={{ paddingHorizontal: 24, paddingTop: 32 }}>
            Staff accounts are created by your gym. Ask an owner or manager to add you.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
