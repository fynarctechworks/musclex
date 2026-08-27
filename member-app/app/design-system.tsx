import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../src/ui/ScreenHeader';
import { PresetGallery } from '../src/ui/PresetGallery';

/**
 * Route shell only. The content lives in src/ui/PresetGallery.tsx so it can be
 * mounted by a test without a router — the same split as app/gallery.tsx.
 */
export default function DesignSystemRoute() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Design system (preset)" onBack={() => router.back()} />
      <View className="flex-1">
        <PresetGallery />
      </View>
    </SafeAreaView>
  );
}
