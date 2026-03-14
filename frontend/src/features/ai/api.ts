import { apiClient } from '@/services/api-client';

export const aiApi = {
  chat: (data: { message: string; conversation_id?: string }) =>
    apiClient.post('/ai/chat', data),

  getDailyBriefing: () =>
    apiClient.get('/ai/daily-briefing'),

  getConversations: () =>
    apiClient.get('/ai/conversations'),
};
