import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Gallery } from '../src/ui/Gallery';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color } from '../src/ui/theme';

/**
 * Route shell only. The content lives in src/ui/Gallery.tsx so it can be
 * mounted in a test without a navigator.
 */
export default function GalleryRoute() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Design system" onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <Gallery />
      </View>
    </SafeAreaView>
  );
}
