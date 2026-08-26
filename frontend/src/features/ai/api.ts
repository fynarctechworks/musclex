import { apiClient } from '@/services/api-client';
import type { ChatResponse, DailyBriefing, Conversation } from './types';

export const aiApi = {
  chat: (data: { message: string; conversation_id?: string }) =>
    apiClient.post<ChatResponse>('/ai/chat', data),

  getDailyBriefing: () =>
    apiClient.get<DailyBriefing>('/ai/daily-briefing'),

  /** Whether the advisor is live. Drives the "coming soon" state. */
  getStatus: () => apiClient.get<{ available: boolean }>('/ai/status'),

  getConversations: () =>
    apiClient.get<{ data: Conversation[] }>('/ai/conversations'),
};
