import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Icon, Input, Screen, Txt, colors } from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { useChatMessages, useSendMessage, chatKeys } from '../../src/api/queries';
import { getChatSocket, emitTyping } from '../../src/realtime/chat-socket';
import { track } from '../../src/analytics';
import type { ChatMessageList } from '../../src/api/types';

/**
 * Trainer conversation (V2.3). Polls messages while open; sends go through the
 * offline outbox with an optimistic bubble. Text-only for now.
 */
export default function ConversationScreen() {
  const { trainerId, name } = useLocalSearchParams<{ trainerId: string; name?: string }>();
  const tid = trainerId ?? '';
  const qc = useQueryClient();
  const { data, isLoading } = useChatMessages(tid);
  const send = useSendMessage(tid);
  const [text, setText] = useState('');
  const [trainerTyping, setTrainerTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const typingSentAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = data?.messages ?? [];
  const trainerName = data?.trainerName ?? name ?? 'Trainer';

  useEffect(() => {
    if (tid) track({ name: 'trainer_chat_opened', trainerId: tid });
  }, [tid]);

  // Live delivery over WebSocket (instant; the 30s poll is only a backstop).
  useEffect(() => {
    if (!tid) return;
    const socket = getChatSocket();
    const onMessage = (m: {
      id?: string;
      sender?: 'member' | 'trainer';
      body?: string;
      createdAt?: string;
      trainerId?: string;
    }) => {
      if (m?.trainerId && m.trainerId !== tid) return; // a different conversation
      qc.setQueryData<ChatMessageList>(chatKeys.messages(tid), (old) => {
        const existing = old?.messages ?? [];
        if (m.id && existing.some((x) => x.id === m.id)) return old; // dedupe
        const appended = [
          ...existing,
          { id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt },
        ];
        return old
          ? { ...old, messages: appended }
          : { trainerId: tid, messages: appended };
      });
      qc.invalidateQueries({ queryKey: chatKeys.threads });
    };
    const onTyping = (d: { trainerId?: string }) => {
      if (d?.trainerId !== tid) return;
      setTrainerTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTrainerTyping(false), 3500);
    };
    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [tid, qc]);

  function onChangeText(t: string) {
    setText(t);
    // Throttle typing pings to ~1 every 2s.
    const now = Date.now();
    if (tid && now - typingSentAt.current > 2000) {
      typingSentAt.current = now;
      emitTyping(tid);
    }
  }

  function onSend() {
    const body = text.trim();
    if (!body) return;
    send.mutate(body);
    track({ name: 'trainer_message_sent', trainerId: tid });
    setText('');
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="border-b border-hairline px-md pb-sm pt-md">
          <BackButton />
          <Txt variant="display-sm" weight="600" className="text-ink">
            {trainerName}
          </Txt>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-md"
          contentContainerStyle={{ paddingVertical: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => {
            const mine = m.sender === 'member';
            const sending = !!m.id?.startsWith('temp-');
            return (
              <View
                key={m.id}
                className={mine ? 'self-end' : 'self-start'}
                style={{ maxWidth: '82%', opacity: sending ? 0.6 : 1 }}
              >
                <View
                  className={`rounded-2xl px-md py-sm ${
                    mine ? 'bg-primary' : 'border border-hairline bg-surface'
                  }`}
                >
                  <Txt variant="body-md" className={mine ? 'text-on-primary' : 'text-ink'}>
                    {m.body}
                  </Txt>
                </View>
                {sending ? (
                  <Txt variant="caption" className="mt-xxs self-end text-mute">
                    Sending…
                  </Txt>
                ) : null}
              </View>
            );
          })}
          {trainerTyping ? (
            <View className="self-start rounded-2xl border border-hairline bg-surface px-md py-sm">
              <Txt variant="body-sm" className="text-mute">
                {trainerName} is typing…
              </Txt>
            </View>
          ) : null}
          {messages.length === 0 && !isLoading ? (
            <Txt variant="body-sm" className="mt-2xl text-center text-mute">
              Say hello to your coach.
            </Txt>
          ) : null}
        </ScrollView>

        {/* Composer */}
        <View className="flex-row items-center gap-sm border-t border-hairline px-md py-sm">
          <View className="flex-1">
            <Input
              placeholder="Message"
              value={text}
              onChangeText={onChangeText}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
          </View>
          <Pressable
            onPress={onSend}
            disabled={!text.trim()}
            accessibilityLabel="Send message"
            className="h-[44px] w-[44px] items-center justify-center rounded-full bg-primary"
            style={{ opacity: text.trim() ? 1 : 0.5 }}
          >
            <Icon name="chevron-right" color={colors.onPrimary} size={22} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
