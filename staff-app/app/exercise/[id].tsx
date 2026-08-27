import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/ui/Loading';
import { ErrorState } from '@/ui/States';
import { useExercise } from '@/api/queries';
import { describeMuscle, describeMuscleGroup, describeTargetMuscle } from '@/lib/training';
import { titleiseSlug } from '@/lib/format';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * EXERCISE DETAIL
 * ────────────────────────────────────────────────────────────────
 *
 * Where the GIF earns its place. The list deliberately shows the still — a
 * hundred animating images in a scrolling list is a lot of decode for no extra
 * meaning — so this is the only screen that answers the question a trainer is
 * actually asking: what does the movement look like.
 *
 * Read-only. Editing the catalogue is a desktop job (`PATCH /exercises/:id`
 * exists and the web app uses it); on a gym floor this screen is opened to
 * show a member how something is done.
 */
export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useExercise(id);
  const e = query.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Stack.Screen options={{ headerShown: true, title: e?.name ?? 'Exercise' }} />

      {query.isLoading ? (
        <Loading />
      ) : query.error || !e ? (
        <ErrorState
          title="Could not load this exercise"
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          {/*
            The animation, full width. Square because every illustration in the
            set is square; a fixed aspect ratio stops the card resizing as
            images load and shoving the text below it around.
          */}
          {e.media_url ? (
            <View
              className="overflow-hidden rounded-xl border border-border bg-card"
              style={{ aspectRatio: 1 }}>
              <Image
                source={{ uri: e.media_url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                accessibilityLabel={`Animated demonstration of ${e.name}`}
              />
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text className="text-2xl font-semibold text-foreground">{e.name}</Text>
            <Text className="text-[15px] text-muted-foreground">
              {describeMuscle(e.muscle_group, e.target_muscle)}
            </Text>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {e.equipment ? (
              <Badge variant="secondary"><Text>{titleiseSlug(e.equipment, '')}</Text></Badge>
            ) : null}
            {e.tracking_type ? (
              <Badge variant="secondary">
                <Text>{e.tracking_type === 'duration' ? 'Timed' : 'Reps'}</Text>
              </Badge>
            ) : null}
            {e.is_active === false ? (
              <Badge variant="destructive"><Text>Archived</Text></Badge>
            ) : null}
          </View>

          {/*
            Secondary muscles matter to a trainer building a session — they are
            why you do not stack two movements that quietly train the same
            thing — so they get their own block rather than being crushed into
            the subtitle.
          */}
          {e.secondary_muscles?.length ? (
            <View className="rounded-xl border border-border bg-card" style={{ padding: 16, gap: 8 }}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Also works
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {e.secondary_muscles.map((m) => (
                  <Badge key={m} variant="outline">
                    <Text>{describeTargetMuscle(m) ?? describeMuscleGroup(m)}</Text>
                  </Badge>
                ))}
              </View>
            </View>
          ) : null}

          {e.instructions ? (
            <View className="rounded-xl border border-border bg-card" style={{ padding: 16, gap: 8 }}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                How to
              </Text>
              <Text className="text-[15px] leading-6 text-foreground">{e.instructions}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
