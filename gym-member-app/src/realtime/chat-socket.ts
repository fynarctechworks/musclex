import { io, type Socket } from 'socket.io-client';
import { config } from '../config';
import { sessionBridge } from '../api/session-bridge';

/**
 * Single shared socket for the trainer-chat namespace. Sends still go over REST
 * (idempotent + offline outbox); this connection only RECEIVES live messages and
 * typing, and emits the member's own typing. The auth callback reads the current
 * access token on every (re)connect, so token refresh is handled transparently.
 */
let socket: Socket | null = null;

/** Server origin (strip the `/member/v1` API path off the base URL). */
function serverOrigin(): string {
  try {
    const u = new URL(config.apiBaseUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return config.apiBaseUrl.replace(/\/member\/v1\/?$/, '');
  }
}

export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(`${serverOrigin()}/member-chat`, {
      transports: ['websocket'],
      // Function form → the freshest token is sent on every (re)connect.
      auth: (cb) => cb({ token: sessionBridge.accessToken ?? '' }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
  }
  return socket;
}

/** Member is typing to a trainer — relayed to the trainer's app. */
export function emitTyping(trainerId: string): void {
  socket?.connected && socket.emit('chat:typing', { trainerId });
}

/** Tear down on sign-out so a stale session can't keep a socket open. */
export function closeChatSocket(): void {
  socket?.close();
  socket = null;
}
