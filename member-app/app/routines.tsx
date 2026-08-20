import { useState } from 'react';
import { Image, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Icon, Label, Loading, Row, Txt } from '../src/ui';
import { Confirm, Notice } from '../src/ui/Notice';
import { color, font, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import {
  useDeleteRoutine,
  useImportRoutine,
  useRoutines,
  useShareRoutine,
} from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * MY ROUTINES
 * ────────────────────────────────────────────────────────────────
 *
 * A member's own saved workouts: personal, repeatable, and shareable by link.
 *
 * Sharing hands over a COPY, not a subscription. Someone who adds your routine
 * gets their own editable version, and your later changes never reach them —
 * which is what "add it to mine" should mean, and avoids a workout silently
 * changing under someone mid-session.
 */

/** Where a share link points. Universal-link setup is a separate deploy step,
 *  so the code is also accepted directly for anyone who cannot open the URL. */
const SHARE_BASE = (process.env.EXPO_PUBLIC_PAY_BASE_URL ?? 'https://app.musclex.infynarc.com') + '/r';

export default function RoutinesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useRoutines();
  const share = useShareRoutine();
  const del = useDeleteRoutine();
  const importRoutine = useImportRoutine();

  const [code, setCode] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading routines" />;
  const routines = data?.routines ?? [];

  async function onShare(id: string, name: string) {
    setNotice(null);
    try {
      const res = await share.mutateAsync(id);
      const url = `${SHARE_BASE}/${res.token}`;
      await Share.share({
        message: `${name} — my workout routine on MuscleX:\n${url}`,
        url,
      });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not create a link',
        body: e instanceof Error ? e.message : 'Please try again.',
      });
    }
  }

  async function onImport() {
    // Accept a full link or the bare code — people paste whichever they have.
    const token = code.trim().split('/').pop()?.trim();
    if (!token) return;
    setNotice(null);
    try {
      const res = await importRoutine.mutateAsync(token);
      setCode('');
      setNotice({
        tone: 'success',
        title: `Added "${res.routine.name}"`,
        body: res.missing.length
          ? `Your gym does not have: ${res.missing.join(', ')}. Everything else was added.`
          : undefined,
      });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not add that routine',
        body: e instanceof Error ? e.message : 'Check the link and try again.',
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="My routines" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {routines.length === 0 ? (
          <>
            <Empty
              title="No routines yet"
              body="Finish a workout and tap Save as routine, and it will be here to repeat next week."
            />
            <Button
              title="Browse ready-made workouts"
              variant="secondary"
              onPress={() => router.push('/explore')}
            />
          </>
        ) : (
          routines.map((r) => (
            <Card key={r.id}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Txt variant="heading">{r.name}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                    {r.exercises.length} exercises
                    {r.importedFromLink ? ' · added from a link' : ''}
                  </Txt>
                </View>
              </Row>

              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
                {r.exercises.slice(0, 6).map((e) =>
                  e.thumbUrl ? (
                    <Image
                      key={e.exerciseId}
                      source={{ uri: e.thumbUrl }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: radius.sm,
                        backgroundColor: color.surface2,
                      }}
                      accessibilityLabel={e.name}
                    />
                  ) : null,
                )}
              </View>

              <Row style={{ marginTop: space.lg, gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Start"
                    size="sm"
                    onPress={() => router.push(`/session?routine=${r.id}`)}
                  />
                </View>
                <Button
                  title="Share"
                  variant="secondary"
                  size="sm"
                  loading={share.isPending}
                  onPress={() => onShare(r.id, r.name)}
                />
                <Button
                  title="Delete"
                  variant="quiet"
                  size="sm"
                  onPress={() => setConfirmId(r.id)}
                />
              </Row>

              {confirmId === r.id ? (
                <View style={{ marginTop: space.md }}>
                  <Confirm
                    title={`Delete "${r.name}"?`}
                    body="Workouts you already logged from it are kept."
                    confirmLabel="Delete"
                    onCancel={() => setConfirmId(null)}
                    onConfirm={() => {
                      del.mutate(r.id);
                      setConfirmId(null);
                    }}
                  />
                </View>
              ) : null}
            </Card>
          ))
        )}

        <Card>
          <Label>Add someone's routine</Label>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Paste a share link or code. You get your own copy to edit — their later
            changes will not touch it.
          </Txt>
          <Row style={{ marginTop: space.md, gap: space.sm }}>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              placeholder="Link or code"
              placeholderTextColor={color.t4}
              accessibilityLabel="Routine link or code"
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
                fontSize: 15,
              }}
            />
            <Button
              title="Add"
              size="sm"
              onPress={onImport}
              disabled={!code.trim()}
              loading={importRoutine.isPending}
            />
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}
