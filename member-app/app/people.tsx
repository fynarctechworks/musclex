import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, space } from '../src/ui/theme';
import { contactsSupported, hashedContacts, requestContactsPermission } from '../src/lib/contacts';
import {
  useFollowing,
  useMatchContacts,
  useMyCode,
  useSuggestions,
  useToggleFollow,
} from '../src/api/queries';
import type { MatchedPerson } from '../src/api/types';

/**
 * FIND PEOPLE — three ways in, ordered by how much each gives away.
 *
 * Suggestions come from connections the member already has and reveal nothing
 * new. Their code is deliberate and one person at a time. Contacts are last,
 * behind an explicit press, and the copy says exactly what leaves the device —
 * because "we hash them" means nothing to most people, and "your contacts are
 * never uploaded" does.
 */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: suggested, isLoading } = useSuggestions();
  const { data: code } = useMyCode();
  const { data: following } = useFollowing();
  const follow = useToggleFollow();
  const match = useMatchContacts();

  const [matched, setMatched] = useState<MatchedPerson[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Finding people" />;

  const followingIds = new Set((following?.people ?? []).map((p) => p.id));

  async function findFromContacts() {
    setBusy(true);
    setNotice(null);
    try {
      const granted = await requestContactsPermission();
      if (!granted) {
        setNotice({
          tone: 'error',
          title: 'Contacts not allowed',
          body: 'You can still find people by their code or from the suggestions above.',
        });
        return;
      }
      const hashes = await hashedContacts();
      if (hashes.length === 0) {
        setNotice({ tone: 'error', title: 'No usable numbers in your contacts' });
        return;
      }
      const res = await match.mutateAsync(hashes);
      setMatched(res.people);
      if (res.people.length === 0) {
        setNotice({ tone: 'success', title: 'Nobody from your contacts is here yet' });
      }
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not check contacts',
        body: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Find people" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Suggested</Label>
          {(suggested?.people ?? []).length === 0 ? (
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Nobody to suggest yet. Suggestions come from clubs you are in and people you
              already know here.
            </Txt>
          ) : (
            (suggested?.people ?? []).map((p) => (
              <Row key={p.id} style={{ marginTop: space.md }}>
                <Pressable
                  style={{ flex: 1, paddingRight: space.md }}
                  onPress={() => router.push(`/person/${p.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={p.name ?? 'Someone'}
                >
                  <Txt variant="body">{p.name || 'Someone'}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>{p.reason}</Txt>
                </Pressable>
                <Button
                  title={followingIds.has(p.id) ? 'Following' : 'Follow'}
                  variant={followingIds.has(p.id) ? 'secondary' : 'primary'}
                  size="sm"
                  onPress={() => follow.mutate({ id: p.id, following: followingIds.has(p.id) })}
                />
              </Row>
            ))
          )}
        </Card>

        <Card>
          <Label>Your code</Label>
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Share this with someone standing next to you and they can add you.
          </Txt>
          <Txt
            variant="small"
            tone="t1"
            selectable
            style={{ marginTop: space.md, fontWeight: '600' }}
          >
            {code?.link ?? '—'}
          </Txt>
        </Card>

        <Card>
          <Label>From your contacts</Label>
          {/* Says what actually happens. "We hash them" means nothing to most
              people; "your contacts are never uploaded" does. */}
          <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
            Your contacts are never uploaded. Numbers are scrambled on this phone and only the
            scrambled version is checked, so we never see anyone's number — including yours.
          </Txt>
          <View style={{ marginTop: space.md }}>
            <Button
              title={contactsSupported() ? 'Check my contacts' : 'Not available here'}
              variant="secondary"
              disabled={!contactsSupported()}
              loading={busy || match.isPending}
              onPress={findFromContacts}
            />
          </View>

          {matched?.length ? (
            <View style={{ marginTop: space.lg, gap: space.sm }}>
              <Txt variant="caption" tone="t3">
                {matched.length} of your contacts {matched.length === 1 ? 'is' : 'are'} here
              </Txt>
              {matched.map((p) => (
                <Row key={p.id} style={{ marginTop: space.sm }}>
                  <Txt variant="body" style={{ flex: 1 }}>{p.name || 'Someone'}</Txt>
                  <Button
                    title={followingIds.has(p.id) || p.following ? 'Following' : 'Follow'}
                    variant={followingIds.has(p.id) || p.following ? 'secondary' : 'primary'}
                    size="sm"
                    onPress={() =>
                      follow.mutate({ id: p.id, following: followingIds.has(p.id) || p.following })
                    }
                  />
                </Row>
              ))}
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}
