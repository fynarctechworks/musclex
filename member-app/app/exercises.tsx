import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Card, Empty, Loading, Row, Txt } from '../src/ui';
import { font, color, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useExercises } from '../src/api/queries';

/**
 * EXERCISE LIBRARY — the gym's own catalogue, the same rows trainers build
 * plans from. Browsing is a reference act, so this screen only reads; logging
 * happens in a session.
 */
export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useExercises(query);

  const items = data?.exercises ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Exercises" />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search the library"
          placeholderTextColor={color.t4}
          accessibilityLabel="Search exercises"
          style={{
            height: 46,
            borderRadius: radius.md,
            backgroundColor: color.surface,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.lg,
            fontFamily: font,
            fontSize: 15,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <Loading label="Loading library" />
        ) : items.length === 0 ? (
          <Empty
            title={query ? 'No matches' : 'No exercises yet'}
            body={
              query
                ? 'Try a different search.'
                : 'Your gym has not added its exercise catalogue yet.'
            }
          />
        ) : (
          items.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/exercise/${e.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${e.name}`}
            >
              <Card>
                <Row>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Txt variant="bodyStrong">{e.name}</Txt>
                    <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                      {[e.muscleGroup, e.equipment].filter(Boolean).join(' · ') || 'Exercise'}
                    </Txt>
                  </View>
                  {e.favorited ? <Txt style={{ fontSize: 15 }}>★</Txt> : null}
                  <View style={{ marginLeft: space.sm }}><Icon name="chevron" size={16} tone="t4" /></View>
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
