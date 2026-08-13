import { apiClient } from '@/services/api-client';
import type { Conversation, ReplyInput, ReplyResult, ThreadMessage } from './types';

export const whatsappInboxApi = {
  /** Conversation list — one row per counterparty phone, newest first. */
  conversations: (limit = 50) =>
    apiClient.get<Conversation[]>('/whatsapp/inbox', { params: { limit } }),

  /** One thread, oldest → newest. */
  thread: (phone: string, limit = 100) =>
    apiClient.get<ThreadMessage[]>('/whatsapp/inbox/thread', { params: { phone, limit } }),

  /** Staff reply — goes out via the gym's connected WhatsApp sender. */
  reply: (data: ReplyInput) =>
    apiClient.post<ReplyResult>('/whatsapp/inbox/reply', data),
};
