import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Loading, Row, Txt } from '../../src/ui';
import { Notice } from '../../src/ui/Notice';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { cn } from '@/lib/utils';
import { Field } from '../../src/ui/Field';
import { timeOf } from '../../src/lib/datetime';
import { useDirectMessages, useReport, useSendDirectMessage } from '../../src/api/queries';

/**
 * ONE THREAD.
 *
 * Report sits in the header, always available and never gated behind blocking
 * first — wanting something looked at and wanting someone gone are different
 * decisions, and forcing them together means people do neither.
 */
export default function ThreadScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useDirectMessages(id ?? null);
  const send = useSendDirectMessage();
  const report = useReport();

  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading messages" />;

  const messages = data?.messages ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Messages" />
      <ScrollView
        contentContainerClassName="gap-2 px-4 pb-10"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {messages.length === 0 ? (
          <Empty title="Say hello" body="Nothing here yet." />
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              // A TINTED bubble, not a filled one — unlike the coach thread.
              // Person-to-person messages are read in long runs, and a column
              // of solid red is tiring where a single reply is not.
              className={cn(
                'max-w-[82%] rounded-lg border px-3 py-2',
                m.mine
                  ? 'border-primary/30 bg-primary/5 self-end'
                  : 'border-border bg-card self-start',
              )}>
              <Txt variant="body" tone="t1">{m.body}</Txt>
              <Txt variant="caption" tone="t4" className="mt-0.5">{timeOf(m.at)}</Txt>
            </View>
          ))
        )}
      </ScrollView>

      <View
        className="border-border bg-card gap-2 border-t p-4"
        style={{ paddingBottom: 16 + insets.bottom }}>
        <Row className="gap-2">
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            accessibilityLabel="Message"
            className="flex-1"
          />
          <Button
            title="Send"
            size="sm"
            disabled={!draft.trim()}
            loading={send.isPending}
            onPress={async () => {
              const body = draft.trim();
              if (!body) return;
              setDraft('');
              try {
                await send.mutateAsync({ id: id as string, body });
                // Clear a previous failure: leaving "Not sent" above a message
                // that just sent is worse than showing nothing.
                setNotice(null);
              } catch (e) {
                setDraft(body); // Keep what they wrote rather than losing it.
                setNotice({
                  tone: 'error',
                  title: 'Not sent',
                  body: e instanceof Error ? e.message : undefined,
                });
              }
            }}
          />
        </Row>
        <Button
          title="Report this conversation"
          variant="quiet"
          size="sm"
          loading={report.isPending}
          onPress={async () => {
            await report.mutateAsync({ targetKind: 'message', reason: 'reported from thread' });
            setNotice({
              tone: 'success',
              title: 'Reported',
              body: 'Someone will look at this. You can also block them from their activity.',
            });
          }}
        />
      </View>
    </View>
  );
}
