import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import QRCode from 'react-native-qrcode-svg';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
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
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Find people" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Label>Suggested</Label>
          {(suggested?.people ?? []).length === 0 ? (
            <Txt variant="small" tone="t2" className="mt-2">
              Nobody to suggest yet. Suggestions come from clubs you are in and people you
              already know here.
            </Txt>
          ) : (
            (suggested?.people ?? []).map((p) => (
              <Row key={p.id} className="mt-3">
                <Pressable
                  className="flex-1 pr-3"
                  onPress={() => router.push(`/person/${p.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={p.name ?? 'Someone'}
                >
                  <Txt variant="body">{p.name || 'Someone'}</Txt>
                  <Txt variant="caption" tone="t3" className="mt-0.5">{p.reason}</Txt>
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
          <Txt variant="small" tone="t2" className="mt-2">
            Show this to someone standing next to you and they can add you.
          </Txt>
          {code?.link ? (
            <View className="mt-4 items-center">
              {/* Literal white, not a token: a QR code needs true white quiet
                  zone and maximum contrast to scan, whatever the surface does. */}
              <View className="rounded-md p-3" style={{ backgroundColor: '#FFFFFF' }}>
                <QRCode value={code.link} size={168} backgroundColor="#FFFFFF" color="#0c0a09" />
              </View>
            </View>
          ) : null}
          {/* The link stays visible under the code: not every phone can scan,
              and reading it aloud has to remain possible. */}
          <Txt
            variant="caption"
            tone="t3"
            selectable
            className="mt-3 text-center"
          >
            {code?.link ?? '—'}
          </Txt>
          <View className="mt-3">
            <Button
              title="Scan someone's code"
              variant="secondary"
              onPress={() => router.push('/scan')}
            />
          </View>
        </Card>

        <Card>
          <Label>From your contacts</Label>
          {/* Says what actually happens. "We hash them" means nothing to most
              people; "your contacts are never uploaded" does. */}
          <Txt variant="small" tone="t2" className="mt-2">
            Your contacts are never uploaded. Numbers are scrambled on this phone and only the
            scrambled version is checked, so we never see anyone's number — including yours.
          </Txt>
          <View className="mt-3">
            <Button
              title={contactsSupported() ? 'Check my contacts' : 'Not available here'}
              variant="secondary"
              disabled={!contactsSupported()}
              loading={busy || match.isPending}
              onPress={findFromContacts}
            />
          </View>

          {matched?.length ? (
            <View className="mt-4 gap-2">
              <Txt variant="caption" tone="t3">
                {matched.length} of your contacts {matched.length === 1 ? 'is' : 'are'} here
              </Txt>
              {matched.map((p) => (
                <Row key={p.id} className="mt-2">
                  <Txt variant="body" className="flex-1">{p.name || 'Someone'}</Txt>
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
