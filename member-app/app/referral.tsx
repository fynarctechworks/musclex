import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { Field } from '../src/ui/Field';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useApplyReferral } from '../src/api/queries';

/** Apply a friend's referral code. Rewards are decided and granted server-side. */
export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const apply = useApplyReferral();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  async function submit() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setNotice(null);
    try {
      const res = await apply.mutateAsync(value);
      setNotice({
        tone: 'success',
        title: res.message ?? 'Code applied',
        body: res.rewardDescription ?? undefined,
      });
      setCode('');
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not apply that code',
        body: e instanceof Error ? e.message : 'Check the code and try again.',
      });
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Referral" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Have a friend's code?</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Enter it once. Your gym decides what the reward is and applies it to both of you.
          </Txt>
          <Row className="mt-4 gap-2">
            <Field
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="ABC123"
              accessibilityLabel="Referral code"
            className="flex-1" />
            <Button title="Apply" size="sm" onPress={submit} disabled={!code.trim()} loading={apply.isPending} />
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}
