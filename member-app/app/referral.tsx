import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { font, color, radius, space } from '../src/ui/theme';
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
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Referral" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Have a friend's code?</Label>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Enter it once. Your gym decides what the reward is and applies it to both of you.
          </Txt>
          <Row style={{ marginTop: space.lg, gap: space.sm }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="ABC123"
              placeholderTextColor={color.t4}
              accessibilityLabel="Referral code"
              style={{
                flex: 1,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
                borderWidth: 1,
                borderColor: color.line,
                color: color.t1,
                paddingHorizontal: space.lg,
                fontFamily: font,
                fontSize: 16,
                fontWeight: '600',
                letterSpacing: 2,
              }}
            />
            <Button title="Apply" size="sm" onPress={submit} disabled={!code.trim()} loading={apply.isPending} />
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}
