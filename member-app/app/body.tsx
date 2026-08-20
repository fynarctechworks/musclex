import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { font, color, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { BarChart } from '../src/features/Sparkline';
import { shortDate } from '../src/lib/datetime';
import { useAddMetric, useLogWeight, useProgress, useWeight } from '../src/api/queries';
import { useUnits } from '../src/lib/use-units';

/**
 * BODY — weight over time.
 *
 * Weight lives on the PUBLIC fitness surface (`/me/weight`), not the gym
 * schema, because it belongs to the person rather than the gym: it should
 * follow them if they change gyms. Gym-scoped body metrics (waist, body fat)
 * are a separate surface and are not surfaced here yet.
 */
export default function BodyScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useWeight();
  const { data: progress } = useProgress();
  const logWeight = useLogWeight();
  const u = useUnits();
  const addMetric = useAddMetric();
  const [measures, setMeasures] = useState<Record<string, string>>({});

  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading body stats" />;

  const entries = data?.entries ?? [];
  // Chart values are display units so the axis matches the numbers above it.
  const chart = [...entries]
    .slice(-8)
    .map((e) => ({ label: shortDate(e.date), value: Number(u.w(e.weightKg)) }));

  const first = entries[0]?.weightKg;
  const latest = data?.latest?.weightKg;
  const change = first != null && latest != null ? latest - first : null;

  async function save() {
    // The field is in the member's unit; the API is always kg.
    const typed = Number(value);
    if (!typed || typed <= 0) return;
    const kg = u.toKg(typed);
    setNotice(null);
    try {
      await logWeight.mutateAsync(kg);
      setValue('');
      setNotice({ tone: 'success', title: 'Weight logged' });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not log weight',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  /**
   * Circumferences are always centimetres in storage. Only the weight-like
   * fields follow the member's unit, so the conversion is per-field rather
   * than blanket.
   */
  const MEASURES: { key: string; label: string; unit: string }[] = [
    { key: 'chestCm', label: 'Chest', unit: 'cm' },
    { key: 'waistCm', label: 'Waist', unit: 'cm' },
    { key: 'hipsCm', label: 'Hips', unit: 'cm' },
    { key: 'armsCm', label: 'Arms', unit: 'cm' },
    { key: 'thighsCm', label: 'Thighs', unit: 'cm' },
    { key: 'calvesCm', label: 'Calves', unit: 'cm' },
    { key: 'bodyFatPct', label: 'Body fat', unit: '%' },
  ];

  async function saveMeasures() {
    const body: Record<string, number> = {};
    for (const m of MEASURES) {
      const v = Number(measures[m.key]);
      if (v > 0) body[m.key] = v;
    }
    if (!Object.keys(body).length) return;
    setNotice(null);
    try {
      await addMetric.mutateAsync(body);
      setMeasures({});
      setNotice({ tone: 'success', title: 'Measurements saved' });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not save measurements',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Body" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Current</Label>
          <Row style={{ alignItems: 'flex-end', marginTop: space.sm }}>
            <View>
              <Txt variant="display">{u.fw(latest)}</Txt>
              {data?.latest ? (
                <Txt variant="caption" tone="t3">last logged {shortDate(data.latest.date)}</Txt>
              ) : null}
            </View>
            {change != null && entries.length > 1 ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="heading" tone={change <= 0 ? 'good' : 't1'}>
                  {change > 0 ? '+' : ''}
                  {u.fw(Math.abs(change)).replace('--', '0')}
                </Txt>
                <Txt variant="caption" tone="t3">since you started</Txt>
              </View>
            ) : null}
          </Row>
          {progress?.latest?.bmi ? (
            <Row style={{ marginTop: space.md }}>
              <Txt variant="small" tone="t2">BMI</Txt>
              <Txt variant="bodyStrong">{progress.latest.bmi}</Txt>
            </Row>
          ) : null}
        </Card>

        <Card>
          <Label>Log today's weight</Label>
          <Row style={{ marginTop: space.md, gap: space.sm }}>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={latest != null ? u.w(latest) : u.w(75)}
              placeholderTextColor={color.t4}
              accessibilityLabel={`Weight in ${u.weightUnit}`}
              style={{
                flex: 1,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: color.surface2,
                borderWidth: 1,
                borderColor: color.line,
                color: color.t1,
                paddingHorizontal: space.lg,
                fontFamily: font,
                fontSize: 16,
                fontWeight: '600',
              }}
            />
            <Button
              title="Save"
              size="sm"
              onPress={save}
              disabled={!value}
              loading={logWeight.isPending}
            />
          </Row>
        </Card>

        <Card>
          <Label>Measurements</Label>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
            Fill in only what you measured. Blank fields are left alone.
          </Txt>
          {MEASURES.map((m) => (
            <Row key={m.key} style={{ marginTop: space.md }}>
              <Txt variant="small" tone="t2" style={{ flex: 1 }}>
                {m.label}
              </Txt>
              <TextInput
                value={measures[m.key] ?? ''}
                onChangeText={(v) => setMeasures((p) => ({ ...p, [m.key]: v }))}
                keyboardType="decimal-pad"
                placeholder={m.unit}
                placeholderTextColor={color.t4}
                accessibilityLabel={`${m.label} in ${m.unit}`}
                style={{
                  width: 110,
                  height: 42,
                  borderRadius: radius.md,
                  backgroundColor: color.surface2,
                  borderWidth: 1,
                  borderColor: color.line,
                  color: color.t1,
                  textAlign: 'center',
                  fontFamily: font,
                  fontSize: 15,
                }}
              />
            </Row>
          ))}
          <View style={{ marginTop: space.lg }}>
            <Button
              title="Save measurements"
              variant="secondary"
              onPress={saveMeasures}
              loading={addMetric.isPending}
            />
          </View>
        </Card>

        {chart.length > 1 ? (
          <Card>
            <Label>Trend</Label>
            <View style={{ marginTop: space.md }}>
              <BarChart data={chart} tint={color.good} />
            </View>
          </Card>
        ) : null}

        <Card>
          <Label>History</Label>
          {entries.length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              Nothing logged yet.
            </Txt>
          ) : (
            [...entries].reverse().map((e) => (
              <Row key={e.date} style={{ marginTop: space.md }}>
                <Txt variant="small" tone="t2">{shortDate(e.date)}</Txt>
                <Txt variant="bodyStrong">{u.fw(e.weightKg)}</Txt>
              </Row>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
