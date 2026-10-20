import axios, { AxiosError } from 'axios';
import { ensureMswStarted } from './msw-ready';
import {
  ApiErrorPayload,
  CartState,
  ChangePasswordInput,
  CreateOrderInput,
  EditionType,
  LoginInput,
  NftItem,
  NftListParams,
  NftListResponse,
  OrderReceipt,
  QuoteRequest,
  QuoteResponse,
  RegisterInput,
  SessionResponse,
  UpdateProfileInput,
  UpsertWalletInput,
  UserProfile,
  WalletItem,
} from '@/types/contracts';
import type { SimulationConfig } from '@/mocks/db';

const TOKEN_STORAGE_KEY = 'kurio_auth_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class AppApiError extends Error {
  status: number;
  code: ApiErrorPayload['code'];
  fieldErrors?: Record<string, string>;
  details?: any;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || 'Ocorreu um erro inesperado.');
    this.name = 'AppApiError';
    this.status = status;
    this.code = payload.code || 'INTERNAL_ERROR';
    this.fieldErrors = payload.fieldErrors;
    this.details = payload.details;
  }
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  await ensureMswStarted();
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status || 500;
    const data = error.response?.data;

    if (
      status === 401 &&
      data?.code === 'SESSION_EXPIRED' &&
      !error.config?.url?.includes('/auth/login')
    ) {
      for (const listener of sessionExpiredListeners) {
        listener();
      }
    }

    const normalized = new AppApiError(status, {
      code: data?.code || (status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR'),
      message:
        data?.message ||
        (error.code === 'ECONNABORTED'
          ? 'Tempo limite da requisição excedido.'
          : 'Não foi possível concluir a comunicação com o servidor.'),
      fieldErrors: data?.fieldErrors,
      details: data?.details,
    });

    return Promise.reject(normalized);
  }
);

// ==========================================
// Typed REST Service Operations
// ==========================================

export const api = {
  auth: {
    async login(input: LoginInput): Promise<SessionResponse> {
      const res = await apiClient.post<SessionResponse>('/auth/login', input);
      return res.data;
    },
    async register(input: RegisterInput): Promise<SessionResponse> {
      const res = await apiClient.post<SessionResponse>('/auth/register', input);
      return res.data;
    },
    async getSession(signal?: AbortSignal): Promise<SessionResponse> {
      const res = await apiClient.get<SessionResponse>('/auth/session', { signal });
      return res.data;
    },
    async logout(): Promise<void> {
      await apiClient.post('/auth/logout');
    },
  },

  nfts: {
    async list(params: NftListParams, signal?: AbortSignal): Promise<NftListResponse> {
      const query: Record<string, string | number | undefined> = {
        q: params.q || undefined,
        categories:
          params.categories && params.categories.length > 0
            ? params.categories.join(',')
            : undefined,
        networks:
          params.networks && params.networks.length > 0
            ? params.networks.join(',')
            : undefined,
        minPrice: params.minPrice || undefined,
        maxPrice: params.maxPrice || undefined,
        tab: params.tab || 'all',
        sort: params.sort || 'recent',
        page: params.page || 1,
        limit: params.limit || 9,
      };
      const res = await apiClient.get<NftListResponse>('/nfts', {
        params: query,
        signal,
      });
      return res.data;
    },
    async getById(id: string, signal?: AbortSignal): Promise<NftItem> {
      const res = await apiClient.get<NftItem>(`/nfts/${encodeURIComponent(id)}`, {
        signal,
      });
      return res.data;
    },
  },

  favorites: {
    async list(signal?: AbortSignal): Promise<{ nftIds: string[] }> {
      const res = await apiClient.get<{ nftIds: string[] }>('/favorites', { signal });
      return res.data;
    },
    async add(nftId: string): Promise<{ nftIds: string[] }> {
      const res = await apiClient.post<{ nftIds: string[] }>(
        `/favorites/${encodeURIComponent(nftId)}`
      );
      return res.data;
    },
    async remove(nftId: string): Promise<{ nftIds: string[] }> {
      const res = await apiClient.delete<{ nftIds: string[] }>(
        `/favorites/${encodeURIComponent(nftId)}`
      );
      return res.data;
    },
  },

  cart: {
    async get(signal?: AbortSignal): Promise<CartState> {
      const res = await apiClient.get<CartState>('/cart', { signal });
      return res.data;
    },
    async addItem(input: {
      nftId: string;
      edition?: EditionType;
      quantity?: number;
    }): Promise<CartState> {
      const res = await apiClient.post<CartState>('/cart/items', input);
      return res.data;
    },
    async updateItemQuantity(
      itemId: string,
      quantity: number,
      acknowledgeChanges?: boolean
    ): Promise<CartState> {
      const res = await apiClient.patch<CartState>(
        `/cart/items/${encodeURIComponent(itemId)}`,
        { quantity, acknowledgeChanges }
      );
      return res.data;
    },
    async removeItem(itemId: string): Promise<CartState> {
      const res = await apiClient.delete<CartState>(
        `/cart/items/${encodeURIComponent(itemId)}`
      );
      return res.data;
    },
    async applyCoupon(code: string): Promise<CartState> {
      const res = await apiClient.post<CartState>('/cart/coupon', { code });
      return res.data;
    },
    async removeCoupon(): Promise<CartState> {
      const res = await apiClient.delete<CartState>('/cart/coupon');
      return res.data;
    },
    async acknowledgeChanges(): Promise<CartState> {
      const res = await apiClient.post<CartState>('/cart/acknowledge');
      return res.data;
    },
  },

  quote: {
    async validate(input: QuoteRequest): Promise<QuoteResponse> {
      const res = await apiClient.post<QuoteResponse>('/quote', input);
      return res.data;
    },
  },

  orders: {
    async create(input: CreateOrderInput): Promise<OrderReceipt> {
      const res = await apiClient.post<OrderReceipt>('/orders', input, {
        headers: {
          'Idempotency-Key': input.idempotencyKey,
        },
      });
      return res.data;
    },
    async list(signal?: AbortSignal): Promise<{ orders: OrderReceipt[] }> {
      const res = await apiClient.get<{ orders: OrderReceipt[] }>('/orders', { signal });
      return res.data;
    },
    async getById(orderId: string, signal?: AbortSignal): Promise<OrderReceipt> {
      const res = await apiClient.get<OrderReceipt>(
        `/orders/${encodeURIComponent(orderId)}`,
        { signal }
      );
      return res.data;
    },
  },

  profile: {
    async get(signal?: AbortSignal): Promise<UserProfile> {
      const res = await apiClient.get<UserProfile>('/profile', { signal });
      return res.data;
    },
    async update(input: UpdateProfileInput): Promise<UserProfile> {
      const res = await apiClient.put<UserProfile>('/profile', input);
      return res.data;
    },
    async changePassword(
      input: ChangePasswordInput
    ): Promise<{ ok: boolean; message: string }> {
      const res = await apiClient.put<{ ok: boolean; message: string }>(
        '/profile/password',
        input
      );
      return res.data;
    },
  },

  wallets: {
    async list(signal?: AbortSignal): Promise<{ wallets: WalletItem[] }> {
      const res = await apiClient.get<{ wallets: WalletItem[] }>('/wallets', {
        signal,
      });
      return res.data;
    },
    async upsert(
      kind: 'primary' | 'secondary',
      input: UpsertWalletInput
    ): Promise<{ wallet: WalletItem; wallets: WalletItem[] }> {
      const res = await apiClient.put<{ wallet: WalletItem; wallets: WalletItem[] }>(
        `/wallets/${kind}`,
        input
      );
      return res.data;
    },
  },

  sim: {
    async getState() {
      const res = await apiClient.get<{
        sim: SimulationConfig;
        nftsCount: number;
        ordersCount: number;
      }>('/__sim__/state');
      return res.data;
    },
    async updateConfig(patch: Partial<SimulationConfig>) {
      const res = await apiClient.post<{ sim: SimulationConfig }>(
        '/__sim__/config',
        patch
      );
      return res.data;
    },
    async reset(seedCartWithFigmaItems = false) {
      const res = await apiClient.post<{ ok: boolean; sim: SimulationConfig }>(
        '/__sim__/reset',
        { seedCartWithFigmaItems }
      );
      return res.data;
    },
    async emitNftUpdated(input: {
      nftId: string;
      edition?: EditionType;
      priceEth?: string;
      available?: number;
      forceVersion?: number;
      forceEventId?: string;
    }) {
      const res = await apiClient.post('/__sim__/emit-nft-updated', input);
      return res.data;
    },
    async emitOrderUpdated(input: {
      orderId: string;
      status: 'confirmed' | 'declined';
      failureReason?: string;
      forceVersion?: number;
      forceEventId?: string;
    }) {
      const res = await apiClient.post('/__sim__/emit-order-updated', input);
      return res.data;
    },
    async disconnectSockets() {
      const res = await apiClient.post('/__sim__/disconnect-sockets');
      return res.data;
    },
  },
};
