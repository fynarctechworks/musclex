import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt } from './index';
import { space } from './theme';

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
    >
      <Txt variant="title">{title}</Txt>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Txt variant="small" tone="t2">Close</Txt>
      </Pressable>
    </View>
  );
}
