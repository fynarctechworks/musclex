import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/ui/Sheet';
import { RowCard } from '@/ui/RowCard';
import { Loading } from '@/ui/Loading';
import { useMembers } from '@/api/queries';
import { initialsOf } from '@/features/MemberRow';
import type { Member } from '@/api/types';

/**
 * Book a walk-in into a class.
 *
 * Search rather than a picker over the whole gym: a studio has thousands of
 * members and the trainer already knows who is standing there.
 *
 * Deliberately does NOT filter out members who are already booked. The server
 * rejects a duplicate with a clear conflict, and hiding them here would mean a
 * trainer searching for someone finds nothing and concludes they are not a
 * member — which is a worse answer than "already booked".
 */
export function BookMemberSheet({
  open, onClose, onPick, busy,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (member: Member) => void;
  busy?: boolean;
}) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset between openings, so the last search does not greet the next walk-in.
  React.useEffect(() => {
    if (!open) { setSearch(''); setDebounced(''); }
  }, [open]);

  const enabled = debounced.length >= 2;
  const query = useMembers(enabled ? { search: debounced, limit: 15 } : { limit: 0 });
  const results = enabled ? (query.data?.data ?? []) : [];

  return (
    <Sheet open={open} onClose={onClose} title="Book a member in" snapPoints={['70%']}>
      <View className="gap-3 px-4 pb-4">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone or member code"
          autoCapitalize="none"
          autoFocus
          testID="book-member-search"
        />

        {busy ? (
          <Loading />
        ) : !enabled ? (
          <Text className="text-sm text-muted-foreground">Type at least 2 characters.</Text>
        ) : query.isLoading ? (
          <Loading />
        ) : results.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            Nothing matched “{debounced}”.
          </Text>
        ) : (
          <View className="gap-2">
            {results.map((m) => (
              <RowCard
                key={m.id}
                initials={initialsOf(m.full_name)}
                title={m.full_name}
                subtitle={m.member_code}
                chevron={false}
                onPress={() => onPick(m)}
                testID={`book-${m.member_code}`}
              />
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}
