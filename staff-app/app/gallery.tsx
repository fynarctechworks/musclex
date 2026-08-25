import React from 'react';
import { Stack } from 'expo-router';
import { Gallery } from '@/ui/Gallery';

/**
 * Route shell only. The gallery content lives in src/ui/Gallery.tsx so it can
 * be mounted in tests without a navigator — <Stack.Screen> requires one.
 */
export default function GalleryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Design system' }} />
      <Gallery />
    </>
  );
}
