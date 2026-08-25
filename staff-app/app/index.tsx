import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';
import { Loading } from '@/ui/Loading';

/**
 * Entry route.
 *
 * With both (auth) and (tabs) present, expo-router has no unmatched-route
 * default — without this the app boots to a blank screen. This is the single
 * place that decides where a cold start lands.
 */
export default function Index() {
  const { session, ready } = useSession();

  // SecureStore is async. Redirecting before it resolves would bounce a
  // signed-in user to sign-in and back on every cold start.
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Loading />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)/sign-in'} />;
}
