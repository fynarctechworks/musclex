import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { Chip } from '../../src/ui/Chip';
import { Field } from '../../src/ui/Field';
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
    <View className="mt-2 flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={labelFor(o)} active={value === o} onPress={() => onChange(o)} />
      ))}
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

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Account</Label>
          <Row className="mt-3">
            <Txt variant="small" tone="t2">Phone</Txt>
            <Txt variant="bodyStrong">{data.phone}</Txt>
          </Row>
          <Txt variant="caption" tone="t3" className="mt-2">
            Your number is how your gym identifies you. Ask the front desk to change it.
          </Txt>
        </Card>

        <Card>
          <Label>Units</Label>
          <Txt variant="caption" tone="t3" className="mt-2">
            Display only. Everything you have already logged is converted, not rewritten.
          </Txt>
          <Txt variant="caption" tone="t3" className="mt-3">Weight</Txt>
          <Choice options={['kg', 'lb']} value={weightUnit} onChange={setWeightUnit} />
          <Txt variant="caption" tone="t3" className="mt-3">Height</Txt>
          <Choice options={['cm', 'ft']} value={heightUnit} onChange={setHeightUnit} />
        </Card>

        <Card>
          <Label>Height</Label>
          <Field
            value={height}
            onChangeText={setHeight}
            keyboardType="number-pad"
            placeholder="178"
            accessibilityLabel={`Height in ${heightUnit === 'ft' ? 'feet' : 'centimetres'}`}
            className="mt-2"
          />
          <Txt variant="caption" tone="t3" className="mt-2">
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
