import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { color, space } from '../../src/ui/theme';
import {
  useBlockPerson,
  useOpenConversation,
  usePerson,
  useToggleFollow,
} from '../../src/api/queries';

/**
 * SOMEONE'S CARD — what a scanned code or a suggestion resolves to.
 *
 * Deliberately thin: a name, two counts, and what you can do about them. An id
 * is not a secret, so it must not be a key to reading somebody's account.
 */
export default function PersonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = usePerson(id ?? null);
  const follow = useToggleFollow();
  const block = useBlockPerson();
  const openDm = useOpenConversation();
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading || !data) return <Loading label="Loading" />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title={data.name || 'Person'} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Card>
          <Txt variant="title">{data.name || 'Someone'}</Txt>
          <Row style={{ marginTop: space.lg, justifyContent: 'flex-start', gap: space.xl }}>
            <View>
              <Txt variant="heading">{data.followerCount}</Txt>
              <Txt variant="caption" tone="t3">followers</Txt>
            </View>
            <View>
              <Txt variant="heading">{data.followingCount}</Txt>
              <Txt variant="caption" tone="t3">following</Txt>
            </View>
          </Row>
        </Card>

        {data.isYou ? (
          <Card>
            <Label>This is you</Label>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
              Share your code from Find people and someone can add you.
            </Txt>
          </Card>
        ) : (
          <>
            <Button
              title={data.youFollow ? 'Following' : 'Follow'}
              variant={data.youFollow ? 'secondary' : 'primary'}
              loading={follow.isPending}
              onPress={() => follow.mutate({ id: data.id, following: data.youFollow })}
            />
            <Button
              title="Message"
              variant="secondary"
              loading={openDm.isPending}
              onPress={async () => {
                try {
                  const c = await openDm.mutateAsync(data.id);
                  router.push(`/dm/${c.id}`);
                } catch (e) {
                  // Their inbox rule, not a failure — say what it is.
                  setNotice({
                    tone: 'error',
                    title: 'Cannot message them',
                    body: e instanceof Error ? e.message : undefined,
                  });
                }
              }}
            />
            <Button
              title="Block"
              variant="quiet"
              size="sm"
              loading={block.isPending}
              onPress={async () => {
                await block.mutateAsync(data.id);
                setNotice({
                  tone: 'success',
                  title: 'Blocked',
                  body: 'They will not see your activities and you will not see theirs.',
                });
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
