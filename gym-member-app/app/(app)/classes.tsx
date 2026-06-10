import { Alert, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
} from '../../src/design-system';
import {
  useClasses,
  useBookClass,
  useCancelClassBooking,
} from '../../src/api/queries';
import { formatTime, relativeFromNow } from '../../src/lib/format';
import type { ClassListItem } from '../../src/api/types';

/**
 * Classes tab (BLUEPRINT.md Module 8 — Class Booking). The same classes gym staff
 * create on the admin Schedule, with live seat counts and the member's own booking
 * state. Book = enroll (or join the waitlist when full); the admin Schedule reflects
 * the booking immediately (shared tables). Now a top-level tab in the blueprint IA.
 */
export default function ClassesScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useClasses();
  const book = useBookClass();
  const cancel = useCancelClassBooking();

  const classes = data?.classes ?? [];
  const busyId =
    (book.isPending && book.variables) ||
    (cancel.isPending && cancel.variables) ||
    null;

  async function onBook(item: ClassListItem) {
    if (!item.id) return;
    try {
      const res = await book.mutateAsync(item.id);
      if (res.status === 'waitlisted') {
        Alert.alert(
          'Added to waitlist',
          `“${item.title}” is full. You're #${res.waitlistPosition ?? '?'} on the waitlist — we'll move you up if a spot opens.`,
        );
      } else {
        Alert.alert('Booked', `You're enrolled in “${item.title}”. See you there!`);
      }
    } catch (err) {
      Alert.alert(
        'Could not book',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }

  function onCancel(item: ClassListItem) {
    if (!item.id) return;
    const waitlisted = item.bookingStatus === 'waitlisted';
    Alert.alert(
      waitlisted ? 'Leave waitlist?' : 'Cancel booking?',
      `“${item.title}” · ${formatTime(item.startsAt)}`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: waitlisted ? 'Leave' : 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await cancel.mutateAsync(item.id as string);
              if (res.promotedMemberName) {
                Alert.alert('Spot released', 'Your seat was given to the next member on the waitlist.');
              }
            } catch (err) {
              Alert.alert(
                'Could not cancel',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      {/* Hero header with the brand mesh gradient (design.md: hero scale only). */}
      <View className="overflow-hidden px-md pb-lg pt-md">
        <Txt variant="mono" className="text-ink/70">
          BOOK A SPOT
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Classes
        </Txt>
        <Txt variant="body-sm" className="mt-xxs text-body">
          Upcoming sessions at your gym
        </Txt>
      </View>

      <View className="px-md">
        {isLoading ? (
          <View className="gap-md">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : classes.length === 0 ? (
          <Card>
            <EmptyState
              icon="calendar"
              title="No upcoming classes"
              message="Your gym hasn't scheduled any classes yet. Pull to refresh once they do."
            />
          </Card>
        ) : (
          <View className="gap-md">
            {classes.map((item) => (
              <ClassCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onBook={() => onBook(item)}
                onCancel={() => onCancel(item)}
              />
            ))}
          </View>
        )}

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}

function ClassCard({
  item,
  busy,
  onBook,
  onCancel,
}: {
  item: ClassListItem;
  busy: boolean;
  onBook: () => void;
  onCancel: () => void;
}) {
  const full = (item.seatsLeft ?? 0) <= 0;
  const enrolled = item.booked && item.bookingStatus === 'enrolled';
  const waitlisted = item.booked && item.bookingStatus === 'waitlisted';

  return (
    <Card elevated>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-md">
          <Txt variant="body-lg" weight="600" className="text-ink">
            {item.title}
          </Txt>
          <Txt variant="body-sm" className="mt-xs text-body">
            {formatTime(item.startsAt)} · {item.durationMinutes ?? 0}m ·{' '}
            {relativeFromNow(item.startsAt)}
          </Txt>
        </View>
        {enrolled ? (
          <Badge label="BOOKED" tone="success" />
        ) : waitlisted ? (
          <Badge label={`WAITLIST #${item.waitlistPosition ?? ''}`} tone="warning" />
        ) : (
          <Badge
            label={full ? 'FULL' : `${item.seatsLeft} LEFT`}
            tone={full ? 'error' : 'neutral'}
          />
        )}
      </View>

      {/* Meta row: trainer / room / capacity */}
      <View className="mt-sm flex-row flex-wrap items-center gap-md">
        {item.trainerName ? (
          <MetaItem icon="user" label={item.trainerName} />
        ) : null}
        {item.room ? <MetaItem icon="pin" label={item.room} /> : null}
        <MetaItem icon="users" label={`${item.seatsLeft}/${item.capacity}`} />
      </View>

      <View className="mt-md">
        {item.booked ? (
          <Button
            title={waitlisted ? 'Leave waitlist' : 'Cancel booking'}
            variant="ghost"
            size="md"
            fullWidth
            loading={busy}
            onPress={onCancel}
          />
        ) : (
          <Button
            title={full ? 'Join waitlist' : 'Book class'}
            variant={full ? 'secondary' : 'primary'}
            size="md"
            fullWidth
            loading={busy}
            onPress={onBook}
          />
        )}
      </View>
    </Card>
  );
}

function MetaItem({ icon, label }: { icon: 'user' | 'pin' | 'users'; label: string }) {
  const theme = useThemeColors();
  return (
    <View className="flex-row items-center gap-xs">
      <Icon name={icon} color={theme.mute} size={15} />
      <Txt variant="caption" className="text-body">
        {label}
      </Txt>
    </View>
  );
}
