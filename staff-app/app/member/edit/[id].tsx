import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/ui/Loading';
import { ErrorState } from '@/ui/States';
import { useMember, useUpdateMember } from '@/api/queries';
import { useToast } from '@/ui/Toast';
import { changedFields } from '@/lib/diff';
import { tokens } from '@/ui/tokens';

/**
 * Edit a member's contact details.
 *
 * Scope is deliberately the three things that change at a counter — a name
 * spelled wrong at signup, a new number, a corrected email. Plans, freezes and
 * transfers each have their own permissioned endpoint and their own
 * consequences; they are not form fields and are not here.
 *
 * Only CHANGED fields are sent. The record has far more columns than this form
 * shows, and a full-object write from a phone would blank the ones the web app
 * collected.
 */
export default function EditMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const query = useMember(id);
  const update = useUpdateMember();

  const member = query.data;

  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  // Guards against the form being re-seeded mid-edit by a background refetch,
  // which would discard whatever the staffer had typed.
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!member || seeded.current) return;
    seeded.current = true;
    setFullName(member.full_name ?? '');
    setPhone(member.phone ?? '');
    setEmail(member.email ?? '');
  }, [member]);

  const original = {
    full_name: member?.full_name ?? '',
    phone: member?.phone ?? '',
    email: member?.email ?? '',
  };
  const changes = changedFields(original, { full_name: fullName, phone, email });
  const dirty = Object.keys(changes).length > 0;
  const valid = fullName.trim().length >= 2 && phone.trim().length >= 7;

  async function submit() {
    setError(null);
    if (!member) return;
    try {
      await update.mutateAsync({ id: member.id, changes });
      toast.show('Member updated');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Edit member' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: tokens.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {query.isLoading ? (
          <Loading />
        ) : query.error || !member ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <View className="gap-1">
              <Label><Text>Full name</Text></Label>
              <Input value={fullName} onChangeText={setFullName}
                     autoCapitalize="words" testID="edit-member-name" />
            </View>

            <View className="gap-1">
              <Label><Text>Phone</Text></Label>
              <Input value={phone} onChangeText={setPhone}
                     keyboardType="phone-pad" testID="edit-member-phone" />
            </View>

            <View className="gap-1">
              <Label><Text>Email</Text></Label>
              <Input value={email} onChangeText={setEmail} placeholder="Not on record"
                     autoCapitalize="none" keyboardType="email-address"
                     testID="edit-member-email" />
            </View>

            <Text className="text-sm text-muted-foreground">
              {member.member_code} · joined this gym as recorded on the web app. Plans,
              freezes and transfers are managed from the member's page.
            </Text>

            {error ? (
              <Text className="text-sm" style={{ color: tokens.destructive }}>{error}</Text>
            ) : null}

            <Button
              onPress={submit}
              disabled={!dirty || !valid || update.isPending}
              testID="edit-member-save">
              <Text>
                {update.isPending ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
              </Text>
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
