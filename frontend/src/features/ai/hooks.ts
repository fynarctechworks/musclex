import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { aiApi } from './api';

export function useAiConversations() {
  return useQuery({
    queryKey: queryKeys.ai.conversations(),
    queryFn: () => aiApi.getConversations(),
  });
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
  });
}
