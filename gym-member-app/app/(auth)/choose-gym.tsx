import { useState } from 'react';
import { View } from 'react-native';
import { Card, Screen, Txt } from '../../src/design-system';
import { useAuth } from '../../src/auth/auth-store';

/** Multi-gym members pick which gym to enter (TRD §1.2 multi-gym branch). */
export default function ChooseGym() {
  const choices = useAuth((s) => s.pendingTenantChoices) ?? [];
  const chooseGym = useAuth((s) => s.chooseGym);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(tenantId?: string) {
    if (!tenantId) return;
    setError(null);
    setBusyId(tenantId);
    try {
      await chooseGym(tenantId);
      // AuthGate routes onward.
    } catch {
      setError('Could not start a session for that gym. Try again.');
      setBusyId(null);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View className="pt-2xl">
        <Txt variant="display-lg" weight="600" className="text-ink">
          Choose your gym
        </Txt>
        <Txt variant="body-md" className="mt-xs mb-xl text-body">
          Your number is linked to more than one gym. Which one are you using?
        </Txt>

        <View className="gap-sm">
          {choices.map((c) => (
            <Card key={c.tenantId} onPress={() => pick(c.tenantId)} elevated>
              <View className="flex-row items-center justify-between">
                <Txt variant="body-lg" weight="600" className="text-ink">
                  {c.gymName ?? 'Gym'}
                </Txt>
                <Txt variant="body-sm" className="text-mute">
                  {busyId === c.tenantId ? 'Opening…' : '→'}
                </Txt>
              </View>
            </Card>
          ))}
        </View>

        {error ? (
          <Txt variant="caption" className="mt-md text-error">
            {error}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}
