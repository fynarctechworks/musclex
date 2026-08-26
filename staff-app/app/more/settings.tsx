import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/ui/Loading';
import { ErrorState } from '@/ui/States';
import { Sheet } from '@/ui/Sheet';
import { Can } from '@/rbac/Gate';
import { useStudioSettings, useUpdateStudio } from '@/api/queries';
import { useToast } from '@/ui/Toast';
import { changedFields } from '@/lib/diff';
import { formatDate, titleiseSlug } from '@/lib/format';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * SETTINGS — the gym's own details
 * ────────────────────────────────────────────────────────────────
 *
 * The web app has seventeen settings pages. This is deliberately not a port of
 * them: on a phone the ones that matter are the gym's contact details (which
 * change when a gym moves or gets a new number) and a readable statement of
 * what plan it is on. Roles, permissions, integrations, payment gateways and
 * tax templates are desktop work — long forms configured once — and porting
 * them would produce screens nobody opens on a phone.
 *
 * SUBSCRIPTION IS READ-ONLY. Changing a plan is a payment-gateway flow with
 * Apple-IAP implications (plan §10 R5); showing the state without offering to
 * change it is honest and keeps that decision on the web.
 */
const FIELDS = [
  { key: 'name', label: 'Gym name', placeholder: 'MuscleX Andheri' },
  { key: 'tagline', label: 'Tagline', placeholder: 'Train hard, stay honest' },
  { key: 'phone', label: 'Phone', placeholder: '98100 00000' },
  { key: 'email', label: 'Email', placeholder: 'hello@gym.com' },
  { key: 'website', label: 'Website', placeholder: 'gym.com' },
  { key: 'address', label: 'Address', placeholder: 'Street' },
  { key: 'city', label: 'City', placeholder: 'Mumbai' },
] as const;

export default function Settings() {
  const toast = useToast();
  const query = useStudioSettings();
  const update = useUpdateStudio();
  const studio = query.data;

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  // Seed the form only when the sheet OPENS, so a background refetch cannot
  // overwrite what the owner is halfway through typing.
  function openEditor() {
    if (!studio) return;
    const seeded: Record<string, string> = {};
    for (const f of FIELDS) seeded[f.key] = (studio as never as Record<string, string>)[f.key] ?? '';
    setDraft(seeded);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    if (!studio) return;

    const original: Record<string, string> = {};
    for (const f of FIELDS) original[f.key] = (studio as never as Record<string, string>)[f.key] ?? '';
    const changes = changedFields(original, draft);

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    if ('name' in changes && changes.name.trim().length < 2) {
      setError('The gym needs a name.');
      return;
    }

    try {
      await update.mutateAsync(changes);
      setEditing(false);
      toast.show('Settings saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Can module="settings">
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
            {query.isLoading ? (
              <Loading />
            ) : query.error || !studio ? (
              <ErrorState onRetry={() => void query.refetch()} />
            ) : (
              <>
                <View className="gap-3 rounded-xl border border-border bg-card p-4">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Gym details
                  </Text>
                  {FIELDS.map((f) => {
                    const value = (studio as never as Record<string, string>)[f.key];
                    return (
                      <View key={f.key} className="flex-row items-baseline justify-between gap-3">
                        <Text className="text-sm text-muted-foreground">{f.label}</Text>
                        <Text
                          numberOfLines={1}
                          className={value ? 'flex-1 text-right text-sm text-foreground'
                                           : 'flex-1 text-right text-sm text-muted-foreground'}>
                          {value || 'Not set'}
                        </Text>
                      </View>
                    );
                  })}

                  <Can module="settings" action="edit">
                    <Button variant="outline" onPress={openEditor} testID="edit-settings">
                      <Text>Edit details</Text>
                    </Button>
                  </Can>
                </View>

                <View className="gap-3 rounded-xl border border-border bg-card p-4">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subscription
                  </Text>
                  <Row label="Plan" value={titleiseSlug(studio.subscription_plan, 'Not set')} />
                  <Row
                    label="Status"
                    value={titleiseSlug(studio.subscription_status, 'Unknown')}
                    badge={studio.subscription_status === 'active' ? 'success' : 'warning'}
                  />
                  {studio.next_billing_date ? (
                    <Row label="Next billing" value={formatDate(studio.next_billing_date)} />
                  ) : null}
                  {studio.trial_ends_at ? (
                    <Row label="Trial ends" value={formatDate(studio.trial_ends_at)} />
                  ) : null}
                  <Text className="text-xs text-muted-foreground">
                    Plans are changed on the web — billing runs through the payment gateway.
                  </Text>
                </View>

                <View className="gap-3 rounded-xl border border-border bg-card p-4">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Regional
                  </Text>
                  <Row label="Currency" value={studio.currency ?? 'Not set'} />
                  <Row label="Timezone" value={studio.timezone ?? 'Not set'} />
                  {studio.gstin ? <Row label="GSTIN" value={studio.gstin} /> : null}
                </View>

                <Text className="text-xs text-muted-foreground">
                  Roles, integrations, payment gateways and tax templates are configured
                  on the web — they are long forms set up once.
                </Text>
              </>
            )}
          </ScrollView>
        </Can>
      </SafeAreaView>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit gym details"
             snapPoints={['80%']}>
        <View className="gap-3 px-4 pb-6">
          {FIELDS.map((f) => (
            <View key={f.key} className="gap-1">
              <Label><Text>{f.label}</Text></Label>
              <Input
                value={draft[f.key] ?? ''}
                onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t }))}
                placeholder={f.placeholder}
                autoCapitalize={f.key === 'email' || f.key === 'website' ? 'none' : 'sentences'}
                keyboardType={f.key === 'phone' ? 'phone-pad' : 'default'}
                testID={`setting-${f.key}`}
              />
            </View>
          ))}

          {error ? (
            <Text className="text-sm" style={{ color: tokens.destructive }}>{error}</Text>
          ) : null}

          <Button onPress={save} disabled={update.isPending} testID="save-settings">
            <Text>{update.isPending ? 'Saving…' : 'Save'}</Text>
          </Button>
        </View>
      </Sheet>
    </>
  );
}

function Row({
  label, value, badge,
}: { label: string; value: string; badge?: 'success' | 'warning' }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {badge ? (
        <Badge variant={badge}><Text>{value}</Text></Badge>
      ) : (
        <Text className="text-sm text-foreground">{value}</Text>
      )}
    </View>
  );
}
