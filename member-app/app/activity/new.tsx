import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Row, Txt } from '../../src/ui';
import { Chip } from '../../src/ui/Chip';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, font, radius, space } from '../../src/ui/theme';
import { useCreateActivity, useSports } from '../../src/api/queries';
import type { SportType } from '../../src/api/types';

/**
 * MANUAL ACTIVITY — something done without the app running.
 *
 * Deliberately short. Every field beyond sport and duration is optional,
 * because the alternative to a two-field form is the member not logging the
 * session at all, and a session recorded roughly beats one lost entirely.
 */
export default function NewActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: sportData } = useSports();
  const create = useCreateActivity();

  const [sport, setSport] = useState('run');
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  const sports: SportType[] = sportData?.sports ?? [];
  const chosen = sports.find((s) => s.key === sport);

  const seconds = useMemo(
    () => (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60,
    [hours, minutes],
  );

  // Grouped exactly as the sport list is grouped, so the picker matches how
  // people look for their sport rather than one flat list of forty-seven.
  const groups = useMemo(() => {
    const out = new Map<string, SportType[]>();
    for (const s of sports) {
      const list = out.get(s.group) ?? [];
      list.push(s);
      out.set(s.group, list);
    }
    return [...out.entries()];
  }, [sports]);

  async function save() {
    if (seconds <= 0) {
      setNotice({ tone: 'error', title: 'How long did it take?', body: 'Enter hours or minutes.' });
      return;
    }
    setNotice(null);
    try {
      const distanceKm = Number(km);
      const activity = await create.mutateAsync({
        sportType: sport,
        source: 'manual',
        // Backdated to when it would have started, so it lands on the right
        // day in the calendar rather than at the moment it was typed in.
        startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        elapsedSeconds: seconds,
        movingSeconds: seconds,
        title: title.trim() || undefined,
        distanceM:
          chosen?.distanceBased && Number.isFinite(distanceKm) && distanceKm > 0
            ? Math.round(distanceKm * 1000)
            : undefined,
      });
      router.replace(`/activity/${activity.id}`);
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not save it',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Add activity" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Sport</Label>
          {groups.map(([group, list]) => (
            <View key={group} style={{ marginTop: space.md }}>
              <Txt variant="caption" tone="t4" style={{ marginBottom: space.sm }}>
                {group.toUpperCase()}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {list.map((s) => (
                  <Chip
                    key={s.key}
                    label={s.label}
                    active={s.key === sport}
                    onPress={() => setSport(s.key)}
                  />
                ))}
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Label>How long</Label>
          <Row style={{ marginTop: space.md, gap: space.sm }}>
            <Field value={hours} onChange={setHours} placeholder="Hours" label="Hours" />
            <Field value={minutes} onChange={setMinutes} placeholder="Minutes" label="Minutes" />
          </Row>
          {chosen?.distanceBased ? (
            <View style={{ marginTop: space.md }}>
              <Field value={km} onChange={setKm} placeholder="Distance in km" label="Distance in km" />
            </View>
          ) : null}
        </Card>

        <Card>
          <Label>Name it</Label>
          <View style={{ marginTop: space.md }}>
            <Field
              value={title}
              onChange={setTitle}
              placeholder={chosen ? `${chosen.label} — optional` : 'Optional'}
              label="Activity name"
              numeric={false}
            />
          </View>
        </Card>

        <Button title="Save activity" onPress={save} loading={create.isPending} />
      </ScrollView>
    </View>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  label,
  numeric = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  numeric?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={placeholder}
      placeholderTextColor={color.t4}
      accessibilityLabel={label}
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
      }}
    />
  );
}
