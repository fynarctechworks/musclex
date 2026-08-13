// ── WhatsApp Inbox Types ──────────────────────────────────
// Shapes mirror backend/src/whatsapp/whatsapp-inbox.service.ts

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'received' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ConversationMember {
  id: string;
  full_name: string;
  member_code?: string;
}

export interface Conversation {
  phone: string;
  member: ConversationMember | null;
  last_message: string;
  last_direction: MessageDirection;
  last_at: string;
  inbound_count: number;
}

export interface ThreadMessage {
  id: string;
  direction: MessageDirection;
  message_type: string;
  body: string;
  status: MessageStatus;
  created_at: string;
  member: { id: string; full_name: string } | null;
}

export interface ReplyInput {
  phone: string;
  text: string;
}

export interface ReplyResult {
  delivered: boolean;
  message_id: string | null;
}
