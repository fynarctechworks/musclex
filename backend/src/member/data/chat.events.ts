/**
 * Internal domain event fired when a trainer-chat message is created (member-sent
 * today; trainer-sent once that path exists). The MemberChatGateway listens and
 * fans the message out over WebSocket to the member's devices and the trainer.
 */
export const TRAINER_CHAT_MESSAGE = 'trainer-chat.message';

export interface TrainerChatMessagePayload {
  gymId: string;
  memberId: string;
  trainerId: string;
  message: {
    id: string;
    sender: 'member' | 'trainer';
    body: string;
    createdAt: string;
    /** So the client can route the message to the right conversation. */
    trainerId: string;
  };
}
