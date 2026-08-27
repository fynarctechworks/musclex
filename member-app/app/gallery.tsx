import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Gallery } from '../src/ui/Gallery';
import { ScreenHeader } from '../src/ui/ScreenHeader';

/**
 * Route shell only. The content lives in src/ui/Gallery.tsx so it can be
 * mounted in a test without a navigator.
 */
export default function GalleryRoute() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Design system" onBack={() => router.back()} />
      <View className="flex-1">
        <Gallery />
      </View>
    </SafeAreaView>
  );
}
