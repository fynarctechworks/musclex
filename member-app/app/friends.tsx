import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Confirm, Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { cn } from '@/lib/utils';
import { Field } from '../src/ui/Field';
import { useUnits } from '../src/lib/use-units';
import { Icon } from '../src/ui/Icon';
import {
  useAcceptSentRoutine,
  useFriendFeed,
  useFriendKudos,
  useFriendRemove,
  useFriendRequest,
  useFriendRespond,
  useFriends,
  useFriendSearch,
  useRoutineInbox,
  useSetSharePrefs,
  useSharePrefs,
} from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * FRIENDS
 * ────────────────────────────────────────────────────────────────
 *
 * Friends are cross-gym on purpose: the training partner who moved studios is
 * exactly who you want to compare with. Nothing here reads another gym's data —
 * every session and lift shown was published by its owner into the shared
 * layer, gated on their own sharing switches.
 *
 * The feed leads because it is the reason to open the screen twice. The list,
 * requests and switches sit under it.
 */
export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const u = useUnits();

  const { data: friends, isLoading } = useFriends();
  const { data: feed } = useFriendFeed();
  const { data: inbox } = useRoutineInbox();
  const { data: prefs } = useSharePrefs();

  const respond = useFriendRespond();
  const remove = useFriendRemove();
  const kudos = useFriendKudos();
  const setPrefs = useSetSharePrefs();
  const acceptRoutine = useAcceptSentRoutine();

  const [phone, setPhone] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading friends" />;

  const list = friends?.friends ?? [];
  const incoming = friends?.incoming ?? [];
  const sessions = feed?.sessions ?? [];
  const pendingRoutines = (inbox?.shares ?? []).filter((s) => !s.importedAt);

  async function onKudos(sessionId: string) {
    Haptics.selectionAsync().catch(() => {});
    try {
      await kudos.mutateAsync(sessionId);
    } catch (e) {
      setNotice({ tone: 'error', title: 'Could not send kudos', body: msg(e) });
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Friends" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
        keyboardShouldPersistTaps="handled"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {/* Requests first: an unanswered one blocks everything else this screen offers. */}
        {incoming.length > 0 ? (
          <Card>
            <Label>Friend requests</Label>
            {incoming.map((r) => (
              <Row key={r.requestId} className="mt-3">
                <Txt variant="body" className="flex-1">{r.name}</Txt>
                <Button
                  title="Accept"
                  size="sm"
                  loading={respond.isPending}
                  onPress={() => respond.mutate({ requestId: r.requestId, accept: true })}
                />
                <View className="w-2" />
                <Button
                  title="Ignore"
                  size="sm"
                  variant="quiet"
                  onPress={() => respond.mutate({ requestId: r.requestId, accept: false })}
                />
              </Row>
            ))}
          </Card>
        ) : null}

        {pendingRoutines.length > 0 ? (
          <Card>
            <Label>Routines sent to you</Label>
            {pendingRoutines.map((s) => (
              <Row key={s.id} className="mt-3">
                <View className="flex-1">
                  <Txt variant="body">{s.name}</Txt>
                  <Txt variant="caption" tone="t3">from {s.from}</Txt>
                </View>
                <Button
                  title="Add"
                  size="sm"
                  loading={acceptRoutine.isPending}
                  onPress={async () => {
                    try {
                      const res = await acceptRoutine.mutateAsync(s.id);
                      setNotice({
                        tone: 'success',
                        title: `Added "${s.name}"`,
                        body: res.missing?.length
                          ? `Your gym does not stock: ${res.missing.join(', ')}`
                          : undefined,
                      });
                    } catch (e) {
                      setNotice({ tone: 'error', title: 'Could not add it', body: msg(e) });
                    }
                  }}
                />
              </Row>
            ))}
          </Card>
        ) : null}

        {/* ── Feed ── */}
        <Label>Recent workouts</Label>
        {sessions.length === 0 ? (
          <Empty
            title="Nothing here yet"
            body={
              list.length === 0
                ? 'Add a friend by their phone number to see what they are training.'
                : 'Your friends have not shared a workout yet. Sharing is off until each person turns it on.'
            }
          />
        ) : (
          sessions.map((s) => (
            <Card key={s.id}>
              <Row className="items-start">
                <View className="flex-1">
                  <Txt variant="body" className="font-semibold">{s.name}</Txt>
                  <Txt variant="caption" tone="t3" className="mt-0.5">
                    {when(s.performedAt)} · {s.exerciseCount} exercises · {s.setCount} sets
                    {s.totalVolumeKg ? ` · ${u.fv(s.totalVolumeKg)}` : ''}
                  </Txt>
                </View>
              </Row>

              {s.exerciseNames.length > 0 ? (
                <Txt variant="small" tone="t2" className="mt-2">
                  {s.exerciseNames.slice(0, 4).join(' · ')}
                  {s.exerciseNames.length > 4 ? ` +${s.exerciseNames.length - 4}` : ''}
                </Txt>
              ) : null}

              <Row className="mt-3">
                <Pressable
                  onPress={() => onKudos(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={s.kudosedByMe ? 'Remove kudos' : 'Give kudos'}
                  hitSlop={8}
                  className={cn(
                    'rounded-full border px-3 py-2 active:opacity-70',
                    s.kudosedByMe ? 'border-primary bg-primary/5' : 'border-border',
                  )}>
                  <Row className="justify-start gap-1.5">
                    <Icon name="kudos" size={14} tone={s.kudosedByMe ? 't1' : 't2'} decorative />
                    <Txt variant="caption" tone={s.kudosedByMe ? 't1' : 't2'}>
                      {s.kudosedByMe ? 'Kudos given' : 'Kudos'}
                      {s.kudosCount > 0 ? ` · ${s.kudosCount}` : ''}
                    </Txt>
                  </Row>
                </Pressable>
                <View className="flex-1" />
                <Button
                  title="Compare"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push(`/friend/${s.appUserId}`)}
                />
              </Row>
            </Card>
          ))
        )}

        {/* ── Add someone ── */}
        <Card>
          <Label>Add a friend</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            By phone number only. There is no search by name, so nobody can find
            you unless they already have your number.
          </Txt>
          <Field
            value={phone}
            onChangeText={setPhone}
            placeholder="Their phone number"
            keyboardType="phone-pad"
            accessibilityLabel="Friend's phone number"
            className="mt-3"
          />
          <SearchResults phone={phone} onNotice={setNotice} />
        </Card>

        {/* ── My friends ── */}
        {list.length > 0 ? (
          <Card>
            <Label>Your friends</Label>
            {list.map((f) => (
              <View key={f.appUserId}>
                <Row className="mt-3">
                  <Txt variant="body" className="flex-1">{f.name}</Txt>
                  <Button
                    title="Compare"
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/friend/${f.appUserId}`)}
                  />
                  <View className="w-2" />
                  <Button
                    title="Remove"
                    size="sm"
                    variant="quiet"
                    onPress={() => setConfirmRemove(f.appUserId)}
                  />
                </Row>
                {confirmRemove === f.appUserId ? (
                  <View className="mt-3">
                    <Confirm
                      title={`Remove ${f.name}?`}
                      body="They stop seeing your workouts and you stop seeing theirs. Nothing either of you logged is deleted."
                      confirmLabel="Remove"
                      onCancel={() => setConfirmRemove(null)}
                      onConfirm={() => {
                        remove.mutate(f.appUserId);
                        setConfirmRemove(null);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {/* ── Sharing ── */}
        <Card>
          <Label>What friends can see</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Off by default. Turning something off also removes what you already
            shared. Your weight, measurements and food are never shared.
          </Txt>
          <Toggle
            label="My workouts"
            value={!!prefs?.shareSessions}
            busy={setPrefs.isPending}
            onChange={(v) => setPrefs.mutate({ shareSessions: v })}
          />
          <Toggle
            label="My personal records"
            value={!!prefs?.sharePrs}
            busy={setPrefs.isPending}
            onChange={(v) => setPrefs.mutate({ sharePrs: v })}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

function SearchResults({
  phone,
  onNotice,
}: {
  phone: string;
  onNotice: (n: { tone: 'error' | 'success'; title: string; body?: string }) => void;
}) {
  const { data, isFetching } = useFriendSearch(phone);
  const request = useFriendRequest();
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 6) return null;
  if (isFetching) return <Txt variant="caption" tone="t3" className="mt-3">Searching…</Txt>;

  const results = data?.results ?? [];
  if (results.length === 0) {
    return (
      <Txt variant="small" tone="t3" className="mt-3">
        Nobody with that number uses MuscleX yet.
      </Txt>
    );
  }

  return (
    <>
      {results.map((r) => (
        <Row key={r.appUserId} className="mt-3">
          <Txt variant="body" className="flex-1">{r.name}</Txt>
          {r.status === 'accepted' ? (
            <Txt variant="caption" tone="t3">Already friends</Txt>
          ) : r.status === 'pending' ? (
            <Txt variant="caption" tone="t3">Request sent</Txt>
          ) : r.status === 'blocked' ? (
            <Txt variant="caption" tone="t3">Unavailable</Txt>
          ) : (
            <Button
              title="Add"
              size="sm"
              loading={request.isPending}
              onPress={async () => {
                try {
                  await request.mutateAsync(r.appUserId);
                  onNotice({ tone: 'success', title: `Request sent to ${r.name}` });
                } catch (e) {
                  onNotice({ tone: 'error', title: 'Could not send request', body: msg(e) });
                }
              }}
            />
          )}
        </Row>
      ))}
    </>
  );
}

function Toggle({
  label,
  value,
  busy,
  onChange,
}: {
  label: string;
  value: boolean;
  busy: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row className="mt-3">
      <Txt variant="body" className="flex-1">{label}</Txt>
      <Button
        title={value ? 'On' : 'Off'}
        size="sm"
        variant={value ? 'primary' : 'secondary'}
        loading={busy}
        onPress={() => onChange(!value)}
      />
    </Row>
  );
}

const msg = (e: unknown) => (e instanceof Error ? e.message : undefined);

/** Relative day label — a feed reads better as "today" than as a date. */
function when(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
