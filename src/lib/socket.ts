import type { Socket } from 'socket.io-client';
import { QueryClient } from '@tanstack/react-query';
import {
  NftUpdatedEvent,
  OrderUpdatedEvent,
  NftItem,
  NftListResponse,
  OrderReceipt,
} from '@/types/contracts';
import { queryKeys } from './query';
import { ensureMswStarted } from './msw-ready';

type RealtimeNoticeListener = (notice: {
  id: string;
  type: 'nft.updated' | 'order.updated' | 'socket.reconnected';
  title: string;
  description: string;
  variant?: 'info' | 'warning' | 'success' | 'danger';
  orderId?: string;
  orderStatus?: 'pending' | 'confirmed' | 'declined';
}) => void;

class RealtimeSocketManager {
  private socket: Socket | null = null;
  private connectingPromise: Promise<Socket> | null = null;
  private queryClient: QueryClient | null = null;
  private currentUserId: string | null = null;
  private processedEventIds = new Set<string>();
  private resourceVersions = new Map<string, number>();
  private noticeListeners = new Set<RealtimeNoticeListener>();
  private hadConnectedOnce = false;
  private needsReconcile = false;

  async init(queryClient: QueryClient, userId: string | null) {
    this.queryClient = queryClient;
    this.currentUserId = userId;

    if (this.socket) {
      this.socket.emit('auth:bind', { userId });
      return;
    }

    if (this.connectingPromise) {
      const s = await this.connectingPromise;
      s.emit('auth:bind', { userId: this.currentUserId });
      return;
    }

    // Dynamically import `socket.io-client` AFTER MSW has patched `globalThis.WebSocket`
    // so `engine.io-client` captures the MSW WebSocket proxy rather than native WebSocket.
    this.connectingPromise = (async () => {
      await ensureMswStarted();
      const { io } = await import('socket.io-client');
      const wsOrigin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4173';

      const sock = io(wsOrigin, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        query: {
          userId: this.currentUserId || '',
        },
      });

      this.socket = sock;

      sock.on('connect', () => {
        sock.emit('auth:bind', { userId: this.currentUserId });

        if (this.needsReconcile && this.queryClient) {
          this.needsReconcile = false;
          // Reconcile active resources with REST API after reconnection
          this.reconcileAfterReconnect();
        }
        this.hadConnectedOnce = true;
      });

      sock.on('disconnect', () => {
        if (this.hadConnectedOnce) {
          this.needsReconcile = true;
        }
      });

      sock.on('nft.updated', (raw: NftUpdatedEvent) => {
        this.handleNftUpdated(raw);
      });

      sock.on('order.updated', (raw: OrderUpdatedEvent) => {
        this.handleOrderUpdated(raw);
      });

      return sock;
    })();

    await this.connectingPromise;
  }

  setUserId(userId: string | null) {
    const changed = this.currentUserId !== userId;
    this.currentUserId = userId;
    if (changed) {
      // Clear order version tracking from previous user session
      for (const key of Array.from(this.resourceVersions.keys())) {
        if (key.startsWith('order:')) {
          this.resourceVersions.delete(key);
        }
      }
      if (this.socket?.connected) {
        this.socket.emit('auth:bind', { userId });
      }
    }
  }

  seedNftVersion(nftId: string, version: number) {
    const key = `nft:${nftId}`;
    const curr = this.resourceVersions.get(key) || 0;
    if (version > curr) {
      this.resourceVersions.set(key, version);
    }
  }

  seedOrderVersion(orderId: string, version: number) {
    const key = `order:${orderId}`;
    const curr = this.resourceVersions.get(key) || 0;
    if (version > curr) {
      this.resourceVersions.set(key, version);
    }
  }

  private handleNftUpdated(event: NftUpdatedEvent) {
    if (!event || !event.eventId || !event.resourceId) return;

    // 1. Deduplicate by eventId
    if (this.processedEventIds.has(event.eventId)) {
      return;
    }

    // 2. Discard stale/out-of-order versions
    const versionKey = `nft:${event.resourceId}`;
    const lastVersion = this.resourceVersions.get(versionKey) || 0;
    if (event.version <= lastVersion) {
      return;
    }

    this.processedEventIds.add(event.eventId);
    this.resourceVersions.set(versionKey, event.version);

    if (!this.queryClient) return;

    const updatedNft = event.payload.nft;

    // Update NFT detail cache directly if present
    this.queryClient.setQueryData<NftItem>(
      queryKeys.nfts.detail(event.resourceId),
      (prev) => {
        if (!prev || prev.version < updatedNft.version) {
          return updatedNft;
        }
        return prev;
      }
    );

    // Update NFT list caches in-place
    this.queryClient.setQueriesData<NftListResponse>(
      { queryKey: ['nfts', 'list'] },
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === updatedNft.id && item.version < updatedNft.version
              ? updatedNft
              : item
          ),
        };
      }
    );

    // Reconcile cart state so updated prices/availability and quoteHash are reflected
    this.queryClient.invalidateQueries({
      queryKey: queryKeys.cart(this.currentUserId),
    });

    this.emitNotice({
      id: event.eventId,
      type: 'nft.updated',
      title: `Atualização em tempo real: ${updatedNft.title}`,
      description: `Edição ${event.payload.edition}: preço ${event.payload.priceEth} ETH (${event.payload.available} disponíveis).`,
      variant: event.payload.available === 0 ? 'danger' : 'warning',
    });
  }

  private handleOrderUpdated(event: OrderUpdatedEvent) {
    if (!event || !event.eventId || !event.resourceId) return;

    // Prevent events from a previous user session from updating another user's state
    if (event.userId && this.currentUserId && event.userId !== this.currentUserId) {
      return;
    }
    if (!this.currentUserId) {
      return;
    }

    // 1. Deduplicate by eventId
    if (this.processedEventIds.has(event.eventId)) {
      return;
    }

    // 2. Discard stale versions or regressions on terminal orders
    const versionKey = `order:${event.resourceId}`;
    const lastVersion = this.resourceVersions.get(versionKey) || 0;
    if (event.version <= lastVersion) {
      return;
    }

    const existingOrder = this.queryClient?.getQueryData<OrderReceipt>(
      queryKeys.orders.detail(this.currentUserId, event.resourceId)
    );
    if (
      existingOrder &&
      (existingOrder.status === 'confirmed' || existingOrder.status === 'declined')
    ) {
      // Terminal state already reached; never regress!
      return;
    }

    this.processedEventIds.add(event.eventId);
    this.resourceVersions.set(versionKey, event.version);

    if (!this.queryClient) return;

    const updatedOrder = event.payload.order;

    this.queryClient.setQueryData<OrderReceipt>(
      queryKeys.orders.detail(this.currentUserId, updatedOrder.id),
      updatedOrder
    );

    this.queryClient.invalidateQueries({
      queryKey: queryKeys.orders.all(this.currentUserId),
    });

    if (updatedOrder.status === 'confirmed') {
      // Refresh cart and catalog stock after confirmed purchase
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.cart(this.currentUserId),
      });
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.nfts.all(),
      });
    }

    this.emitNotice({
      id: event.eventId,
      type: 'order.updated',
      title:
        updatedOrder.status === 'confirmed'
          ? 'Pedido confirmado na rede!'
          : updatedOrder.status === 'declined'
            ? 'Pagamento recusado'
            : 'Pedido atualizado',
      description:
        updatedOrder.status === 'confirmed'
          ? `Transação ${updatedOrder.txHash} confirmada (${updatedOrder.totalEth} ETH).`
          : updatedOrder.failureReason || 'Não foi possível confirmar a transação.',
      variant:
        updatedOrder.status === 'confirmed'
          ? 'success'
          : updatedOrder.status === 'declined'
            ? 'danger'
            : 'info',
      orderId: updatedOrder.id,
      orderStatus: updatedOrder.status,
    });
  }

  reconcileAfterReconnect() {
    if (!this.queryClient) return;
    this.queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all() });
    this.queryClient.invalidateQueries({
      queryKey: queryKeys.cart(this.currentUserId),
    });
    if (this.currentUserId) {
      this.queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all(this.currentUserId),
      });
    }
    this.emitNotice({
      id: `reconn_${Date.now()}`,
      type: 'socket.reconnected',
      title: 'Conexão em tempo real restabelecida',
      description: 'Os dados de catálogo, carrinho e pedidos foram sincronizados.',
      variant: 'info',
    });
  }

  subscribeNotices(listener: RealtimeNoticeListener): () => void {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  private emitNotice(notice: Parameters<RealtimeNoticeListener>[0]) {
    for (const listener of this.noticeListeners) {
      listener(notice);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.hadConnectedOnce = false;
    this.needsReconcile = false;
  }

  reconnect() {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    } else if (!this.socket && this.queryClient) {
      this.init(this.queryClient, this.currentUserId);
    }
  }
}

export const socketManager = new RealtimeSocketManager();
