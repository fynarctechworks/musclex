import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import {
  Card,
  EmptyState,
  Icon,
  Input,
  Screen,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { ScreenHeader } from '../src/navigation/ScreenHeader';
import { useCoachConversation, useCoachChat } from '../src/api/queries';
import { useCapabilities } from '../src/auth/use-capabilities';

/**
 * AI Coach — one rolling chat thread with the gym's AI assistant. Mirrors the
 * trainer-chat conversation screen: the member's messages sit right in the
 * primary (lime) bubble, the coach's replies left in a neutral bubble. The
 * user's message is appended optimistically (via useCoachChat's onMutate) and a
 * typing indicator shows while the reply is in flight; the server response then
 * replaces the thread with the authoritative history. Gym-members only.
 */
export default function CoachScreen() {
  const theme = useThemeColors();
  const { isMember } = useCapabilities();
  const { data, isLoading } = useCoachConversation(isMember);
  const chat = useCoachChat();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Only auto-scroll when the member is already near the bottom (same pattern
  // as trainer chat) so new content doesn't yank them away from history.
  const nearBottom = useRef(true);
  const didInitialScroll = useRef(false);

  const messages = data?.messages ?? [];

  function onSend() {
    const message = text.trim();
    if (!message || chat.isPending) return;
    nearBottom.current = true; // always follow the member's own outgoing message
    chat.mutate(message);
    setText('');
  }

  if (!isMember) {
    return (
      <Screen scroll>
        <View className="pt-md">
          <ScreenHeader title="AI Coach" />
          <Card className="mt-lg">
            <EmptyState
              compact
              icon="flash"
              title="Join a gym to unlock"
              message="The AI coach knows your plan, workouts and progress — it's available once you're a gym member."
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="border-b border-hairline px-md pb-sm pt-md">
          <ScreenHeader title="AI Coach" className="mb-0" />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-md"
          contentContainerStyle={{ paddingVertical: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={64}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            nearBottom.current =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
          }}
          onContentSizeChange={() => {
            // First paint: jump to the bottom without animation. After that,
            // only follow new content when already at the bottom.
            if (!didInitialScroll.current) {
              didInitialScroll.current = true;
              scrollRef.current?.scrollToEnd({ animated: false });
            } else if (nearBottom.current) {
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {messages.map((m, i) => {
            const mine = m.role === 'user';
            return (
              <View
                key={`${m.timestamp}-${i}`}
                className={mine ? 'self-end' : 'self-start'}
                style={{ maxWidth: '82%' }}
              >
                <View
                  className={`rounded-2xl px-md py-sm ${
                    mine ? 'bg-primary' : 'border border-hairline bg-surface'
                  }`}
                >
                  <Txt variant="body-md" className={mine ? 'text-on-primary' : 'text-ink'}>
                    {m.content}
                  </Txt>
                </View>
              </View>
            );
          })}
          {chat.isPending ? (
            <View className="self-start rounded-2xl border border-hairline bg-surface px-md py-sm">
              <Txt variant="body-sm" className="text-mute">
                Coach is typing…
              </Txt>
            </View>
          ) : null}
          {messages.length === 0 && !isLoading && !chat.isPending ? (
            <Txt variant="body-sm" className="mt-2xl text-center text-mute">
              Ask anything about your training, diet plan or recovery.
            </Txt>
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View className="flex-row items-center gap-sm border-t border-hairline px-md py-sm">
          <View className="flex-1">
            <Input
              placeholder="Ask your coach"
              value={text}
              onChangeText={setText}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
          </View>
          <Pressable
            onPress={onSend}
            disabled={!text.trim() || chat.isPending}
            accessibilityLabel="Send message"
            className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary"
            style={{ opacity: text.trim() && !chat.isPending ? 1 : 0.5 }}
          >
            <Icon name="chevron-right" color={theme.onPrimary} size={22} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
