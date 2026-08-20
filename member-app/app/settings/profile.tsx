import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { font, color, radius, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { useProfile, useUpdateProfile } from '../../src/api/queries';
import { useUnits } from '../../src/lib/use-units';

const GENDERS = ['male', 'female', 'prefer_not_to_say'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const labelFor = (v: string) => v.replace(/_/g, ' ');

function Choice({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value?: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              height: 34,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? color.accentSoft : color.surface2,
              borderWidth: 1,
              borderColor: on ? color.accentEdge : color.line,
            }}
          >
            <Txt variant="caption" tone={on ? 'accent' : 't2'}
              style={{ fontWeight: '600', textTransform: 'capitalize' }}>
              {labelFor(o)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Profile editing. Saves the whole form at once — partial autosave on a screen
 *  this small produces more surprise than it saves. */
export default function ProfileSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useProfile();
  const save = useUpdateProfile();
  const u = useUnits();

  const [height, setHeight] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [weightUnit, setWeightUnit] = useState<string | null>(null);
  const [heightUnit, setHeightUnit] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setHeight(data.heightCm ? String(data.heightCm) : '');
    setGender(data.gender ?? null);
    setLevel(data.trainingExperience ?? null);
    setWeightUnit(data.weightUnit ?? 'kg');
    setHeightUnit(data.heightUnit ?? 'cm');
  }, [data]);

  if (isLoading || !data) return <Loading label="Loading profile" />;

  async function submit() {
    setNotice(null);
    const body: Record<string, unknown> = {};
    if (height) body.heightCm = Number(height);
    if (gender) body.gender = gender;
    if (level) body.trainingExperience = level;
    if (weightUnit) body.weightUnit = weightUnit;
    if (heightUnit) body.heightUnit = heightUnit;
    try {
      await save.mutateAsync(body);
      setNotice({ tone: 'success', title: 'Profile saved' });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not save',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  const input = {
    height: 46,
    borderRadius: radius.md,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    color: color.t1,
    paddingHorizontal: space.lg,
    fontFamily: font,
    fontSize: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Account</Label>
          <Row style={{ marginTop: space.md }}>
            <Txt variant="small" tone="t2">Phone</Txt>
            <Txt variant="bodyStrong">{data.phone}</Txt>
          </Row>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
            Your number is how your gym identifies you. Ask the front desk to change it.
          </Txt>
        </Card>

        <Card>
          <Label>Units</Label>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
            Display only. Everything you have already logged is converted, not rewritten.
          </Txt>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>Weight</Txt>
          <Choice options={['kg', 'lb']} value={weightUnit} onChange={setWeightUnit} />
          <Txt variant="caption" tone="t3" style={{ marginTop: space.md }}>Height</Txt>
          <Choice options={['cm', 'ft']} value={heightUnit} onChange={setHeightUnit} />
        </Card>

        <Card>
          <Label>Height</Label>
          <TextInput
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
            placeholder="178"
            placeholderTextColor={color.t4}
            accessibilityLabel={`Height in ${heightUnit === 'ft' ? 'feet' : 'centimetres'}`}
            style={[input, { marginTop: space.sm }]}
          />
          <Txt variant="caption" tone="t3" style={{ marginTop: space.sm }}>
            Used for BMI and calorie targets.
          </Txt>
        </Card>

        <Card>
          <Label>Gender</Label>
          <Choice options={GENDERS} value={gender} onChange={setGender} />
        </Card>

        <Card>
          <Label>Training experience</Label>
          <Choice options={LEVELS} value={level} onChange={setLevel} />
        </Card>

        <Button title="Save changes" onPress={submit} loading={save.isPending} />
      </ScrollView>
    </View>
  );
}
