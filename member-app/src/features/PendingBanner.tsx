import { Pressable, View } from 'react-native';
import { Txt } from '../ui';
import { useFlush, usePending } from '../api/queries';

/**
 * Shown only when writes are waiting to sync. Deliberately calm: queued work
 * is not an error, it is the app doing its job, and an alarming banner would
 * push members to re-log things that are already safe.
 *
 * The dot is `warning`, not `destructive`, and it is paired with words that say
 * the work is SAVED. Colour never carries this alone — a member who cannot
 * distinguish the hue still reads "waiting to sync", which is the whole message.
 */
export function PendingBanner() {
  const { data: pending } = usePending();
  const flush = useFlush();
  if (!pending) return null;

  return (
    <Pressable
      onPress={() => flush.mutate()}
      accessibilityRole="button"
      accessibilityLabel={`${pending} items waiting to sync. Tap to retry.`}
      className="border-border bg-secondary flex-row items-center justify-between gap-3 rounded-md border px-4 py-3 active:opacity-80">
      <View className="flex-1 flex-row items-center gap-2">
        <View className="bg-warning h-[7px] w-[7px] rounded-full" />
        <Txt variant="small" tone="t2" className="flex-1">
          {pending} {pending === 1 ? 'item' : 'items'} saved on your phone, waiting to sync
        </Txt>
      </View>
      <Txt variant="caption" tone="t3">
        {flush.isPending ? 'Syncing…' : 'Retry'}
      </Txt>
    </Pressable>
  );
}
