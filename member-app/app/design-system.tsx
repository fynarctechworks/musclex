import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../src/ui/ScreenHeader';
import { PresetGallery } from '../src/ui/PresetGallery';
import { color } from '../src/ui/theme';

/**
 * Route shell only. The content lives in src/ui/PresetGallery.tsx so it can be
 * mounted by a test without a router — the same split as app/gallery.tsx.
 *
 * The header still uses theme.ts: this screen is reachable while the app is
 * mid-migration, and a header that did not match the app around it would make
 * the reference harder to trust, not easier.
 */
export default function DesignSystemRoute() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Design system (preset)" onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <PresetGallery />
      </View>
    </SafeAreaView>
  );
}
