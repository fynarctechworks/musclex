import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, Input, Screen, Txt } from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useAuth } from '../src/auth/auth-store';
import { api } from '../src/api/endpoints';
import { emitFunnel } from '../src/analytics/funnel';
import { useHaptics } from '../src/lib/use-haptics';
import { notify } from '../src/lib/confirm';

/**
 * Referral screen (Phase 5c). Shows the user's own code to share and lets them
 * enter a friend's code (attribution, once). Available to every app user.
 */
export default function ReferralScreen() {
  const haptic = useHaptics();
  const code = useAuth((s) => s.context?.referralCode ?? null);
  const refreshProfile = useAuth((s) => s.refreshProfile);

  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!code) return;
    emitFunnel('referral_share', { code });
    try {
      await Share.share({
        message: `Join me on MuscleX! Use my code ${code} when you sign up. 💪`,
      });
    } catch {
      /* user dismissed */
    }
  };

  const apply = async () => {
    const c = entered.trim();
    if (!c) return;
    setBusy(true);
    try {
      const res = await api.applyReferral(c);
      if (res.applied) {
        haptic.success();
        notify('Referral applied', 'Thanks — your referral has been recorded.');
        setEntered('');
        await refreshProfile();
      } else {
        const msg =
          res.reason === 'self'
            ? "You can't use your own code."
            : res.reason === 'already_referred'
              ? 'You already have a referrer.'
              : 'That code is not valid.';
        notify('Could not apply', msg);
      }
    } catch {
      notify('Something went wrong', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Refer & earn" />
      <Txt variant="body-sm" className="mt-xxs text-body">
        Invite friends to MuscleX and grow together
      </Txt>

      <View className="mt-md gap-md">
        {/* Your code */}
        <Card elevated>
          <Txt variant="caption" className="text-mute">
            YOUR REFERRAL CODE
          </Txt>
          <Txt variant="display-lg" weight="600" className="mt-xs text-ink" style={{ letterSpacing: 2 }}>
            {code ?? '—'}
          </Txt>
          <View className="mt-md">
            <Button title="Share my code" size="md" onPress={share} disabled={!code} />
          </View>
        </Card>

        {/* Enter a friend's code */}
        <Card>
          <Txt variant="caption" className="text-mute">
            HAVE A FRIEND'S CODE?
          </Txt>
          <View className="mt-sm">
            <Input
              placeholder="Enter referral code"
              autoCapitalize="characters"
              value={entered}
              onChangeText={setEntered}
            />
          </View>
          <View className="mt-sm">
            <Button
              title={busy ? 'Applying…' : 'Apply code'}
              size="md"
              variant="secondary"
              onPress={apply}
              disabled={busy || entered.trim().length === 0}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
