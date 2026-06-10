import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { Txt, useThemeColors } from '../design-system';
import { COUNTRIES, flagEmoji, type Country } from '../data/countries';

/**
 * Searchable global country list (flag + name + dial code). Presentational — the
 * caller decides where it lives (an in-sheet view, a route, etc.) and handles the
 * pick via {@link onSelect}. Manages its own search state.
 */
export function CountryPickerList({
  onSelect,
  height = 360,
}: {
  onSelect: (c: Country) => void;
  height?: number;
}) {
  const theme = useThemeColors();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q),
      )
    : COUNTRIES;

  return (
    <View>
      <View
        className="flex-row items-center rounded-xl border bg-surface px-md"
        style={{ height: 48, borderColor: theme.hairlineStrong }}
      >
        <TextInput
          style={{ flex: 1, height: '100%', fontSize: 15, color: theme.ink, fontFamily: 'Inter_400Regular' }}
          placeholder="Search country or code"
          placeholderTextColor={theme.mute}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>
      <View style={{ height, marginTop: 8 }}>
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.dial}`}
              className="flex-row items-center border-b border-hairline py-sm"
            >
              <Txt style={{ fontSize: 22 }}>{flagEmoji(item.code)}</Txt>
              <Txt className="ml-sm flex-1 text-ink" numberOfLines={1}>
                {item.name}
              </Txt>
              <Txt className="text-body">{item.dial}</Txt>
            </Pressable>
          )}
          ListEmptyComponent={
            <Txt variant="body-sm" className="mt-lg text-center text-mute">
              No countries match “{query}”.
            </Txt>
          }
        />
      </View>
    </View>
  );
}
