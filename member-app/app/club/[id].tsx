import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { Chip } from '../../src/ui/Chip';
import { Notice } from '../../src/ui/Notice';
import { Field } from '../../src/ui/Field';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { whenOf } from '../../src/lib/datetime';
import { clock } from '../../src/lib/recorder';
import {
  useClub,
  useClubEvents,
  useClubFeed,
  useClubMembers,
  useCreateClubEvent,
  useRsvp,
  useToggleClubMembership,
} from '../../src/api/queries';

/**
 * CLUB — its feed, its events, its people.
 *
 * The feed here is narrowed to club members and then passed through the SAME
 * visibility rule as the main feed. Being in a club shows you WHO; it never
 * changes WHAT they chose to share.
 */
export default function ClubScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = id ?? null;

  const { data: club, isLoading } = useClub(clubId);
  const joined = !!club?.joined;
  const { data: feed } = useClubFeed(clubId, joined);
  const { data: events } = useClubEvents(clubId, joined);
  const { data: members } = useClubMembers(clubId, joined);
  const toggle = useToggleClubMembership();
  const addEvent = useCreateClubEvent();
  const rsvp = useRsvp(clubId ?? '');

  const [tab, setTab] = useState<'feed' | 'events' | 'people'>('feed');
  const [eventTitle, setEventTitle] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading || !club) return <Loading label="Loading club" />;

  const canPostEvents = club.myRole === 'owner' || club.myRole === 'admin';

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title={club.name} />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Row className="items-start">
            <View className="flex-1 pr-3">
              <Txt variant="small" tone="t2">
                {[club.city, `${club.memberCount} ${club.memberCount === 1 ? 'member' : 'members'}`]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
              {club.description ? (
                <Txt variant="small" tone="t2" className="mt-2">
                  {club.description}
                </Txt>
              ) : null}
            </View>
            <Button
              title={joined ? (club.myRole === 'owner' ? 'Owner' : 'Leave') : 'Join'}
              variant={joined ? 'secondary' : 'primary'}
              size="sm"
              disabled={club.myRole === 'owner'}
              loading={toggle.isPending}
              onPress={async () => {
                try {
                  await toggle.mutateAsync({ id: club.id, joined });
                } catch (e) {
                  setNotice({
                    tone: 'error',
                    title: 'Could not do that',
                    body: e instanceof Error ? e.message : undefined,
                  });
                }
              }}
            />
          </Row>
        </Card>

        {!joined ? (
          <Empty
            title="Join to see inside"
            body="A club's feed, events and members are for the people in it."
          />
        ) : (
          <>
            <View className="flex-row gap-2">
              <Chip label="Feed" active={tab === 'feed'} onPress={() => setTab('feed')} />
              <Chip label="Events" active={tab === 'events'} onPress={() => setTab('events')} />
              <Chip label="People" active={tab === 'people'} onPress={() => setTab('people')} />
            </View>

            {tab === 'feed' ? (
              (feed?.activities ?? []).length === 0 ? (
                <Empty
                  title="Nothing shared yet"
                  body="Only what members have chosen to share shows up here."
                />
              ) : (
                (feed?.activities ?? []).map((a) => (
                  <Card key={a.id}>
                    <Row className="items-start">
                      <View className="flex-1">
                        <Txt variant="bodyStrong">{a.mine ? 'You' : a.athlete.name || 'Someone'}</Txt>
                        <Txt variant="caption" tone="t3" className="mt-0.5">
                          {a.title || a.sportType} · {whenOf(a.startedAt)}
                        </Txt>
                      </View>
                    </Row>
                    <Row className="mt-3 justify-start gap-6">
                      {a.distanceM != null ? (
                        <Stat value={(a.distanceM / 1000).toFixed(2)} unit="km" />
                      ) : null}
                      <Stat value={clock(a.elapsedSeconds * 1000)} unit="time" />
                    </Row>
                  </Card>
                ))
              )
            ) : null}

            {tab === 'events' ? (
              <>
                {canPostEvents ? (
                  <Card>
                    <Label>Add an event</Label>
                    <Row className="mt-3 gap-2">
                      <Field
                        value={eventTitle}
                        onChangeText={setEventTitle}
                        placeholder="What and where"
                        accessibilityLabel="Event title"
            className="flex-1" />
                      <Button
                        title="Add"
                        size="sm"
                        disabled={eventTitle.trim().length < 2}
                        loading={addEvent.isPending}
                        onPress={async () => {
                          try {
                            await addEvent.mutateAsync({
                              id: club.id,
                              title: eventTitle.trim(),
                              // Defaults to a week out; the member edits from
                              // there rather than facing a date picker to save
                              // a single line.
                              startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
                            });
                            setEventTitle('');
                          } catch (e) {
                            setNotice({
                              tone: 'error',
                              title: 'Could not add it',
                              body: e instanceof Error ? e.message : undefined,
                            });
                          }
                        }}
                      />
                    </Row>
                    <Txt variant="caption" tone="t3" className="mt-2">
                      Starts a week from now by default.
                    </Txt>
                  </Card>
                ) : null}

                {(events?.events ?? []).length === 0 ? (
                  <Empty title="Nothing scheduled" body="Past events are not shown here." />
                ) : (
                  (events?.events ?? []).map((e) => (
                    <Card key={e.id}>
                      <Txt variant="bodyStrong">{e.title}</Txt>
                      <Txt variant="caption" tone="t3" className="mt-0.5">
                        {whenOf(e.startsAt)}
                        {e.locationName ? ` · ${e.locationName}` : ''}
                      </Txt>
                      <Txt variant="small" tone="t2" className="mt-2">
                        {e.attendeeCount} going
                      </Txt>
                      <View className="mt-3 flex-row gap-2">
                        <Chip
                          label="Going"
                          active={e.myStatus === 'going'}
                          onPress={() =>
                            rsvp.mutate({
                              eventId: e.id,
                              status: e.myStatus === 'going' ? null : 'going',
                            })
                          }
                        />
                        <Chip
                          label="Interested"
                          active={e.myStatus === 'interested'}
                          onPress={() =>
                            rsvp.mutate({
                              eventId: e.id,
                              status: e.myStatus === 'interested' ? null : 'interested',
                            })
                          }
                        />
                      </View>
                    </Card>
                  ))
                )}
              </>
            ) : null}

            {tab === 'people' ? (
              <Card>
                <Label>Members</Label>
                {(members?.members ?? []).map((m) => (
                  <Row key={m.id} className="mt-3">
                    <Txt variant="body">{m.name || 'Someone'}</Txt>
                    <Txt variant="caption" tone="t3">{m.role}</Txt>
                  </Row>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <View>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="t3">{unit}</Txt>
    </View>
  );
}
