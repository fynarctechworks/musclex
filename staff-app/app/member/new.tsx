import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useCreateMember } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { useToast } from '@/ui/Toast';
import { normalisePhone } from '@/lib/contact';
import { tokens } from '@/ui/tokens';

type Gender = 'male' | 'female' | 'other';

/**
 * Add a member.
 *
 * Only the fields the DTO requires plus the two the desk always has to hand.
 * Everything else (DOB, emergency contact, address) is left to the web app —
 * a long form at a busy counter is how members get entered badly or not at all.
 */
export default function NewMember() {
  const { session } = useSession();
  const toast = useToast();
  const create = useCreateMember();

  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [gender, setGender] = React.useState<Gender>('male');
  const [error, setError] = React.useState<string | null>(null);

  const branchId = session?.activeBranchId ?? session?.user?.branch_ids?.[0];
  const phoneDigits = normalisePhone(phone).replace(/^\+/, '');
  // 7 digits is the shortest plausible national number; the server validates
  // properly, this only stops obviously-empty submissions.
  const valid = fullName.trim().length >= 2 && phoneDigits.length >= 7;

  async function submit() {
    setError(null);
    if (!branchId) {
      setError('No branch selected. Pick a branch first.');
      return;
    }
    try {
      const member = await create.mutateAsync({
        fullName, phone, email: email || undefined, branchId, gender,
      });
      toast.show(`${member.full_name} added`);
      // Straight to the new member so the next step (take payment, check in)
      // is one tap away rather than a search.
      router.replace(`/member/${member.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add member');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Add member' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: tokens.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View className="gap-1">
            <Label><Text>Full name</Text></Label>
            <Input value={fullName} onChangeText={setFullName} placeholder="Rahul Sharma"
                   autoCapitalize="words" testID="new-member-name" />
          </View>

          <View className="gap-1">
            <Label><Text>Phone</Text></Label>
            <Input value={phone} onChangeText={setPhone} placeholder="98100 00021"
                   keyboardType="phone-pad" testID="new-member-phone" />
          </View>

          <View className="gap-1">
            <Label><Text>Email (optional)</Text></Label>
            <Input value={email} onChangeText={setEmail} placeholder="rahul@example.com"
                   autoCapitalize="none" keyboardType="email-address" testID="new-member-email" />
          </View>

          <View className="gap-1">
            <Label><Text>Gender</Text></Label>
            <SegmentedControl
              value={gender}
              onChange={setGender}
              segments={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </View>

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button onPress={submit} disabled={!valid || create.isPending} testID="new-member-submit">
            <Text>{create.isPending ? 'Adding…' : 'Add member'}</Text>
          </Button>
          <Text className="text-center text-xs text-muted-foreground">
            Membership and payment are added from the member's page.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
