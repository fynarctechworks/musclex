import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, font, radius, space } from '../src/ui/theme';
import { activeMention, applyMention, matchPeople } from '../src/lib/mention-draft';
import { whenOf } from '../src/lib/datetime';
import { clock } from '../src/lib/recorder';
import {
  useActivityComments,
  useAddComment,
  useBlockPerson,
  useDeleteComment,
  useFeed,
  useFollowing,
  useSports,
  useToggleKudos,
} from '../src/api/queries';
import type { CommentSegment, FeedActivity, SportType } from '../src/api/types';
import { RouteShape } from '../src/features/RouteShape';
import { Icon } from '../src/ui/Icon';

/**
 * ────────────────────────────────────────────────────────────────
 * FEED — activities from people you follow
 * ────────────────────────────────────────────────────────────────
 *
 * The server decides what appears here; this screen never filters. That is
 * deliberate — a client-side visibility check means the hidden activity was
 * already sent to the device, and the rule then lives in two places.
 *
 * Routes arrive already trimmed by the owner's privacy zone, so there is
 * nothing here that could accidentally reveal where someone lives.
 */
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch } = useFeed();
  const { data: sportData } = useSports();
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string } | null>(null);

  if (isLoading) return <Loading label="Loading your feed" />;

  const items = data?.activities ?? [];
  const sports = new Map((sportData?.sports ?? []).map((s: SportType) => [s.key, s]));

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Feed" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {items.length === 0 ? (
          <Empty
            title="Nothing here yet"
            body="Follow someone, or record an activity of your own — yours show up here too."
          />
        ) : (
          items.map((a) => (
            <FeedCard
              key={a.id}
              activity={a}
              sportLabel={sports.get(a.sportType)?.label ?? a.sportType}
              distanceBased={sports.get(a.sportType)?.distanceBased ?? false}
              commentsOpen={open === a.id}
              onToggleComments={() => setOpen(open === a.id ? null : a.id)}
              onBlocked={() => setNotice({ tone: 'success', title: 'Blocked' })}
              onOpen={() => (a.mine ? router.push(`/activity/${a.id}`) : undefined)}
            />
          ))
        )}

        <Button title="Refresh" variant="secondary" size="sm" onPress={() => refetch()} />
      </ScrollView>
    </View>
  );
}

function FeedCard({
  activity: a,
  sportLabel,
  distanceBased,
  commentsOpen,
  onToggleComments,
  onBlocked,
  onOpen,
}: {
  activity: FeedActivity;
  sportLabel: string;
  distanceBased: boolean;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onBlocked: () => void;
  onOpen: () => void;
}) {
  const kudos = useToggleKudos();
  const block = useBlockPerson();
  const km = a.distanceM != null ? a.distanceM / 1000 : null;

  return (
    <Card>
      <Pressable onPress={onOpen} accessibilityRole={a.mine ? 'button' : 'none'}>
        <Row className="items-start">
          <View className="flex-1 pr-3">
            <Txt variant="bodyStrong">
              {a.mine ? 'You' : a.athlete?.name || 'Someone'}
            </Txt>
            <Txt variant="caption" tone="t3" className="mt-0.5">
              {sportLabel} · {whenOf(a.startedAt)}
            </Txt>
          </View>
          {a.mine ? <Txt variant="caption" tone="t4">yours</Txt> : null}
        </Row>

        {a.title ? (
          <Txt variant="heading" className="mt-3">{a.title}</Txt>
        ) : null}

        {a.polyline ? (
          <View className="mt-3">
            {/* Safe to draw: the server has already trimmed this to the
                owner's privacy zone when the activity is not yours. */}
            <RouteShape polyline={a.polyline} height={120} showEnds={false} />
          </View>
        ) : null}

        <Row style={{ marginTop: space.md, justifyContent: 'flex-start', gap: space.xl }}>
          {distanceBased && km != null ? <Stat value={km.toFixed(2)} unit="km" /> : null}
          <Stat value={clock(a.elapsedSeconds * 1000)} unit="time" />
          {a.elevationGainM ? (
            <Stat value={String(Math.round(a.elevationGainM))} unit="m climb" />
          ) : null}
          {a.avgHeartRate ? <Stat value={String(a.avgHeartRate)} unit="bpm" /> : null}
        </Row>
      </Pressable>

      <Row style={{ marginTop: space.lg, justifyContent: 'flex-start', gap: space.md }}>
        <Pressable
          onPress={() => kudos.mutate({ id: a.id, kudosed: a.kudosedByMe })}
          accessibilityRole="button"
          accessibilityLabel={a.kudosedByMe ? 'Take back kudos' : 'Give kudos'}
          accessibilityState={{ selected: a.kudosedByMe }}
          hitSlop={8}
        >
          <Row style={{ gap: 6, justifyContent: 'flex-start' }}>
            {/* Decorative: the word "Kudos" is right beside it, so the icon is
                hidden from the screen reader rather than announced twice. */}
            <Icon
              name="kudos"
              size={16}
              tone={a.kudosedByMe ? 'accent' : 't2'}
              decorative
            />
            <Txt variant="small" tone={a.kudosedByMe ? 'accent' : 't2'} className="font-semibold">
              Kudos{a.kudosCount > 0 ? ` ${a.kudosCount}` : ''}
            </Txt>
          </Row>
        </Pressable>

        <Pressable
          onPress={onToggleComments}
          accessibilityRole="button"
          accessibilityLabel="Comments"
          hitSlop={8}
        >
          <Txt variant="small" tone="t2" className="font-semibold">
            Comments{a.commentCount > 0 ? ` ${a.commentCount}` : ''}
          </Txt>
        </Pressable>

        {/* Blocking lives on the card because that is where someone is when
            they decide they have had enough of a person. */}
        {!a.mine && a.athlete ? (
          <Pressable
            onPress={async () => {
              await block.mutateAsync(a.athlete!.id);
              onBlocked();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Block ${a.athlete.name ?? 'this person'}`}
            hitSlop={8}
          >
            <Txt variant="small" tone="t4">Block</Txt>
          </Pressable>
        ) : null}
      </Row>

      {commentsOpen ? <Comments activityId={a.id} /> : null}
    </Card>
  );
}

/**
 * Comment text with its mentions tappable.
 *
 * The server has already decided which mentions this reader may follow, so a
 * mention that arrives as plain text is not a rendering gap — it is somebody
 * the reader is not allowed to reach.
 */
function CommentBody({ segments }: { segments: CommentSegment[] }) {
  const router = useRouter();
  if (!segments?.length) return null;
  return (
    <Txt variant="small" tone="t2">
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <Txt key={i} variant="small" tone="t2">{seg.value}</Txt>
        ) : (
          <Txt
            key={i}
            variant="small"
            tone="accent"
            className="font-semibold"
            onPress={() => router.push(`/person/${seg.id}`)}
          >
            @{seg.name}
          </Txt>
        ),
      )}
    </Txt>
  );
}

function Comments({ activityId }: { activityId: string }) {
  const { data, isLoading } = useActivityComments(activityId);
  const { data: following } = useFollowing();
  const add = useAddComment();
  const del = useDeleteComment();
  const [draft, setDraft] = useState('');
  const [caret, setCaret] = useState(0);

  const comments = data?.comments ?? [];
  // Only people the member follows — a picker over every member in the product
  // would be a directory, which is not what an @ is for.
  const mention = activeMention(draft, caret);
  const candidates = mention ? matchPeople(following?.people ?? [], mention.query) : [];

  return (
    <View
      style={{
        marginTop: space.lg,
        paddingTop: space.md,
        borderTopWidth: 1,
        borderTopColor: color.line,
        gap: space.sm,
      }}
    >
      {isLoading ? (
        <Txt variant="small" tone="t3">Loading…</Txt>
      ) : comments.length === 0 ? (
        <Txt variant="small" tone="t3">No comments yet.</Txt>
      ) : (
        comments.map((c) => (
          <Row key={c.id} className="items-start">
            <View className="flex-1 pr-2">
              <Txt variant="caption" tone="t3">{c.mine ? 'You' : c.author.name || 'Someone'}</Txt>
              <CommentBody segments={c.segments} />
            </View>
            {c.mine ? (
              <Pressable
                onPress={() => del.mutate({ commentId: c.id, activityId })}
                accessibilityRole="button"
                accessibilityLabel="Delete your comment"
                hitSlop={8}
              >
                <Txt variant="caption" tone="t4">Delete</Txt>
              </Pressable>
            ) : null}
          </Row>
        ))
      )}

      {candidates.length ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: color.line,
            borderRadius: radius.md,
            backgroundColor: color.surface2,
            overflow: 'hidden',
          }}
        >
          {candidates.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                const next = applyMention(draft, mention!.start, caret, p);
                setDraft(next.text);
                setCaret(next.caret);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${p.name}`}
              style={{ paddingVertical: space.sm, paddingHorizontal: space.md }}
            >
              <Txt variant="small" tone="t1">{p.name}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Row className="mt-2 gap-2">
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            // Best effort: onSelectionChange also fires, but typing at the end
            // is the common case and this keeps the picker responsive.
            setCaret(t.length);
          }}
          onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
          placeholder="Say something, or @ someone"
          placeholderTextColor={color.t4}
          accessibilityLabel="Write a comment"
          style={{
            flex: 1,
            height: 42,
            borderRadius: radius.md,
            backgroundColor: color.surface2,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.md,
            fontFamily: font,
            fontSize: 15,
          }}
        />
        <Button
          title="Post"
          size="sm"
          disabled={!draft.trim()}
          loading={add.isPending}
          onPress={async () => {
            const body = draft.trim();
            if (!body) return;
            setDraft('');
            await add.mutateAsync({ id: activityId, body });
          }}
        />
      </Row>
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
