import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { whatsappInboxApi } from './api';

// Local query keys — the shared queryKeys registry doesn't cover the inbox,
// and its root ('whatsapp-inbox') is intentionally NOT in the branch-switch
// preserve set, so switching branches drops the cache like other tenant data.
const whatsappInboxKeys = {
  all: ['whatsapp-inbox'] as const,
  conversations: (limit?: number) => [...whatsappInboxKeys.all, 'conversations', limit] as const,
  thread: (phone: string) => [...whatsappInboxKeys.all, 'thread', phone] as const,
};

/** Poll ~every 15s so new inbound messages surface without a manual refresh. */
const POLL_INTERVAL_MS = 15_000;

export function useConversations(limit = 50) {
  return useQuery({
    queryKey: whatsappInboxKeys.conversations(limit),
    queryFn: () => whatsappInboxApi.conversations(limit),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useThread(phone: string | null, limit = 100) {
  return useQuery({
    queryKey: whatsappInboxKeys.thread(phone ?? ''),
    queryFn: () => whatsappInboxApi.thread(phone!, limit),
    enabled: !!phone,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useSendReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: whatsappInboxApi.reply,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: whatsappInboxKeys.thread(variables.phone) });
      qc.invalidateQueries({ queryKey: [...whatsappInboxKeys.all, 'conversations'] });
    },
    onError: (err: Error) => {
      // Backend message explains the real cause (e.g. WhatsApp isn't connected
      // for this gym — connect it under Integrations first).
      toast.error(err.message);
    },
  });
}
