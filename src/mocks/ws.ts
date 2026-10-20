import { ws } from 'msw';
import { toSocketIo } from '@mswjs/socket.io-binding';
import { NftUpdatedEvent, OrderUpdatedEvent } from '@/types/contracts';

// MSW's WebSocketHandler automatically strips `/^\/socket.io\//` from clientUrl.pathname
// and resolves the origin URL (`http://localhost:4173` -> `ws://localhost:4173`).
const wsBaseOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4173';

export const socketLink = ws.link(wsBaseOrigin);

interface ConnectedClient {
  id: string;
  userId: string | null;
  emit: (event: string, data: unknown) => void;
  close: () => void;
}

const activeClients = new Map<string, ConnectedClient>();

export const wsHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection);
    const clientId = `conn_${Math.random().toString(36).slice(2, 10)}`;

    // Extract optional userId from connection URL query string
    const initialUserId = connection.client.url.searchParams.get('userId') || null;

    // Respond to Engine.IO heartbeat pings ('2' -> '3') and namespace connect ('40')
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        if (event.data === '2') {
          connection.client.send('3');
        } else if (event.data.startsWith('40')) {
          connection.client.send('40' + JSON.stringify({ sid: clientId }));
        }
      }
    });

    const record: ConnectedClient = {
      id: clientId,
      userId: initialUserId,
      emit: (eventName: string, payload: unknown) => {
        try {
          io.client.emit(eventName, payload);
        } catch {
          // Ignore closed socket errors
        }
      },
      close: () => {
        try {
          connection.client.close();
        } catch {
          // Ignore close errors
        }
      },
    };

    activeClients.set(clientId, record);

    io.client.on('auth:bind', (_event, data: { userId?: string | null }) => {
      record.userId = data?.userId || null;
    });

    connection.client.addEventListener('close', () => {
      activeClients.delete(clientId);
    });
  }),
];

/**
 * Broadcasts `nft.updated` to all connected Socket.IO clients.
 */
export function broadcastNftUpdated(event: NftUpdatedEvent): void {
  for (const client of activeClients.values()) {
    client.emit('nft.updated', event);
  }
}

/**
 * Emits `order.updated` only to clients bound to the order's userId (or all if userId matches).
 */
export function broadcastOrderUpdated(event: OrderUpdatedEvent): void {
  for (const client of activeClients.values()) {
    if (!client.userId || client.userId === event.userId) {
      client.emit('order.updated', event);
    }
  }
}

/**
 * Simulates server-side socket disconnect for all active clients (for testing reconnection & reconciliation).
 */
export function disconnectAllMockSockets(): void {
  for (const client of activeClients.values()) {
    client.close();
  }
  activeClients.clear();
}
