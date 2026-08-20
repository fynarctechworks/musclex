import { Pressable, View } from 'react-native';
import { Txt } from '../ui';
import { color, radius, space } from '../ui/theme';
import { useFlush, usePending } from '../api/queries';

/**
 * Shown only when writes are waiting to sync. Deliberately calm: queued work
 * is not an error, it is the app doing its job, and an alarming banner would
 * push members to re-log things that are already safe.
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: color.surface2,
        borderColor: color.line,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.md,
        paddingHorizontal: space.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.warn }} />
        <Txt variant="small" tone="t2">
          {pending} {pending === 1 ? 'item' : 'items'} saved on your phone, waiting to sync
        </Txt>
      </View>
      <Txt variant="caption" tone="t3">{flush.isPending ? 'Syncing…' : 'Retry'}</Txt>
    </Pressable>
  );
}
