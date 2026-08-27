import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Chip } from '../src/ui/Chip';
import { Notice } from '../src/ui/Notice';
import { Field } from '../src/ui/Field';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useCreateClub, useDiscoverClubs, useMyClubs } from '../src/api/queries';
import type { Club } from '../src/api/types';

/**
 * CLUBS — the ones you are in, and the ones you could join.
 *
 * Discovery lists PUBLIC clubs only. A private club is unlisted by design:
 * you get into it because somebody gave you the link, which is the whole of
 * what "private" promises here — no approval queue we would then have to
 * moderate.
 */
export default function ClubsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: mine, isLoading } = useMyClubs();
  const { data: found } = useDiscoverClubs();
  const create = useCreateClub();

  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading clubs" />;

  const joined = mine?.clubs ?? [];
  const joinedIds = new Set(joined.map((c) => c.id));
  const discover = (found?.clubs ?? []).filter((c) => !joinedIds.has(c.id));

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Clubs" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Row>
            <Label>Start a club</Label>
            {!making ? (
              <Button title="New" variant="secondary" size="sm" onPress={() => setMaking(true)} />
            ) : null}
          </Row>
          {making ? (
            <Row className="mt-3 gap-2">
              <Field
                value={name}
                onChangeText={setName}
                placeholder="Club name"
                accessibilityLabel="Club name"
                autoFocus
                className="flex-1" />
              <Button
                title="Create"
                size="sm"
                disabled={name.trim().length < 2}
                loading={create.isPending}
                onPress={async () => {
                  try {
                    const club = await create.mutateAsync({ name: name.trim() });
                    setName('');
                    setMaking(false);
                    router.push(`/club/${club.id}`);
                  } catch (e) {
                    setNotice({
                      tone: 'error',
                      title: 'Could not create it',
                      body: e instanceof Error ? e.message : undefined,
                    });
                  }
                }}
              />
            </Row>
          ) : (
            <Txt variant="small" tone="t2" className="mt-2">
              A club is a group of people, not a gym — yours can span any number of them.
            </Txt>
          )}
        </Card>

        <Label>Your clubs</Label>
        {joined.length === 0 ? (
          <Empty title="Not in any clubs yet" body="Join one below, or start your own." />
        ) : (
          joined.map((c) => (
            <ClubRow key={c.id} club={c} onPress={() => router.push(`/club/${c.id}`)} />
          ))
        )}

        {discover.length ? (
          <>
            <Label>Clubs you could join</Label>
            {discover.map((c) => (
              <ClubRow key={c.id} club={c} onPress={() => router.push(`/club/${c.id}`)} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ClubRow({ club, onPress }: { club: Club; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={club.name}>
      <Card>
        <Row className="items-start">
          <View className="flex-1 pr-3">
            <Txt variant="bodyStrong">{club.name}</Txt>
            <Txt variant="caption" tone="t3" className="mt-0.5">
              {[club.city, `${club.memberCount} ${club.memberCount === 1 ? 'member' : 'members'}`]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </View>
          {club.myRole ? <Chip label={club.myRole} active onPress={onPress} /> : null}
        </Row>
      </Card>
    </Pressable>
  );
}
