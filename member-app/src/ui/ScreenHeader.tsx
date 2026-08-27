import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt } from './index';
import { backOrHome } from '../lib/nav';

/**
 * The title bar with a Close action, shared by every non-tab screen.
 * Close routes through backOrHome, which handles a screen opened by deep link
 * and therefore having no history to go back to.
 */
export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Txt variant="title">{title}</Txt>
      <Pressable
        onPress={onBack ?? (() => backOrHome(router))}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close">
        <Txt variant="small" tone="t2">
          Close
        </Txt>
      </Pressable>
    </View>
  );
}
