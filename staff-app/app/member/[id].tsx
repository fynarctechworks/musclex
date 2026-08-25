import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MessageCircle, Phone } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RowCard } from '@/ui/RowCard';
import { EmptyState, ErrorState } from '@/ui/States';
import { Loading } from '@/ui/Loading';
import { Can } from '@/rbac/Gate';
import { CollectPayment } from '@/features/CollectPayment';
import { useMember } from '@/api/queries';
import { initialsOf, membershipState } from '@/features/MemberRow';
import { callNumber, messageOnWhatsApp } from '@/lib/contact';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';
import { useSession } from '@/auth/SessionProvider';
import { tokens } from '@/ui/tokens';

/**
 * Member detail.
 *
 * Unlike the list, GET /members/:id returns ALL memberships, so this screen can
 * honestly distinguish "expired" from "never had a plan" and show renewal
 * history.
 */
export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [collectOpen, setCollectOpen] = React.useState(false);
  const { session } = useSession();
  const currency = session?.studio?.currency ?? 'INR';
  const query = useMember(id);

  const member = query.data;
  const state = member ? membershipState(member) : null;
  const current = member?.memberships?.[0];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: member?.full_name ?? 'Member' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        {query.isLoading ? (
          <Loading label="Loading member" />
        ) : query.error ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : !member ? (
          <EmptyState title="Member not found" />
        ) : (
          <>
            <View className="items-center gap-2 rounded-lg border border-border bg-card p-5">
              <Avatar alt={member.full_name} className="h-16 w-16">
                <AvatarFallback><Text>{initialsOf(member.full_name)}</Text></AvatarFallback>
              </Avatar>
              <Text className="text-xl font-semibold text-foreground">{member.full_name}</Text>
              <Text className="text-sm text-muted-foreground">{member.member_code}</Text>
              {state ? (
                <Badge variant={state.variant}><Text>{state.label}</Text></Badge>
              ) : null}
            </View>

            {/* Contact — the native win over the web app. */}
            <View className="flex-row gap-3">
              <Button className="flex-1" variant="outline" onPress={() => void callNumber(member.phone)}>
                <Phone size={16} color={tokens.foreground} />
                <Text>Call</Text>
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onPress={() =>
                  void messageOnWhatsApp(
                    member.phone,
                    `Hi ${member.full_name.split(' ')[0]}, this is ${session?.studio?.name ?? 'your gym'}.`,
                  )
                }>
                <MessageCircle size={16} color={tokens.foreground} />
                <Text>WhatsApp</Text>
              </Button>
            </View>

            <Field label="Phone" value={member.phone} />
            {member.email ? <Field label="Email" value={member.email} /> : null}
            {member.join_date ? <Field label="Joined" value={formatDate(member.join_date)} /> : null}
            <Field
              label="Last visit"
              value={member.last_visit_at ? formatRelative(member.last_visit_at) : 'No visits yet'}
            />

            <Separator />

            <Section title="Membership">
              {current ? (
                <RowCard
                  title={current.plan?.name ?? 'Plan'}
                  subtitle={
                    current.end_date
                      ? `${formatDate(current.start_date ?? '')} → ${formatDate(current.end_date)}`
                      : undefined
                  }
                  meta={`Status: ${current.status}`}
                  chevron={false}
                />
              ) : (
                <EmptyState title="No membership on record" />
              )}
            </Section>

            {/* Money is role-gated: a trainer has no payments permission. */}
            <Can module="payments" action="create">
              <Button onPress={() => setCollectOpen(true)} testID="collect-payment">
                <Text>Collect payment</Text>
              </Button>
            </Can>

            <Can module="payments">
              <Section title="Payments">
                {(member.payments ?? []).length === 0 ? (
                  <EmptyState title="No payments yet" />
                ) : (
                  <View className="gap-2">
                    {(member.payments ?? []).slice(0, 5).map((p) => (
                      <RowCard
                        key={p.id}
                        title={formatCurrency(p.amount, p.currency ?? currency)}
                        subtitle={`${p.payment_method} · ${p.status}`}
                        meta={p.paid_at ? formatRelative(p.paid_at) : undefined}
                        chevron={false}
                      />
                    ))}
                  </View>
                )}
              </Section>
            </Can>

            <Can module="check_ins">
              <Section title="Recent visits">
                {(member.check_ins ?? []).length === 0 ? (
                  <EmptyState title="No visits yet" />
                ) : (
                  <View className="gap-2">
                    {(member.check_ins ?? []).slice(0, 5).map((c) => (
                      <RowCard
                        key={c.id}
                        title={formatRelative(c.checked_in_at)}
                        subtitle={c.checkin_method}
                        chevron={false}
                      />
                    ))}
                  </View>
                )}
              </Section>
            </Can>
          </>
        )}
      </ScrollView>

      {/* Outside the ScrollView: a bottom sheet nested in scroll content
          positions itself within that content and lands off-screen. */}
      {member ? (
        <CollectPayment member={member} open={collectOpen} onClose={() => setCollectOpen(false)} />
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}
