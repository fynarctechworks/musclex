import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { aiApi } from './api';
import { toast } from 'sonner';

export function useAiConversations() {
  return useQuery({
    queryKey: queryKeys.ai.conversations(),
    queryFn: () => aiApi.getConversations(),
  });
}

/**
 * Is the AI advisor live?
 *
 * Long-lived: whether the model is connected changes on deploy, not per
 * session, and every AI surface asks. Treated as UNAVAILABLE while loading and
 * on error — a screen that renders the chat composer optimistically and then
 * takes it away is worse than one that says "coming soon" and means it.
 */
export function useAiStatus() {
  const query = useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: () => aiApi.getStatus(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return { ...query, available: query.data?.available === true };
}

export function useDailyBriefing() {
  return useQuery({
    queryKey: queryKeys.ai.briefing(),
    queryFn: () => aiApi.getDailyBriefing(),
  });
}

export function useAiChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: aiApi.chat,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ai.conversations() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
