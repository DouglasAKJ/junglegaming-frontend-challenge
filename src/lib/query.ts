import { QueryClient } from '@tanstack/react-query';
import { NftListParams } from '@/types/contracts';
import { AppApiError } from './api';

export const queryKeys = {
  session: () => ['auth', 'session'] as const,
  nfts: {
    all: () => ['nfts'] as const,
    list: (params: NftListParams) => ['nfts', 'list', params] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },
  favorites: (userId: string | null) => ['favorites', userId || 'guest'] as const,
  cart: (userId: string | null) => ['cart', userId || 'guest'] as const,
  profile: (userId: string | null) => ['profile', userId || 'guest'] as const,
  wallets: (userId: string | null) => ['wallets', userId || 'guest'] as const,
  orders: {
    all: (userId: string | null) => ['orders', userId || 'guest'] as const,
    detail: (userId: string | null, orderId: string) =>
      ['orders', userId || 'guest', orderId] as const,
  },
};

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 15, // 15 seconds fresh window
        gcTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        retry: false,
      },
      mutations: {
        retry: false, // Mutations never auto-retry to avoid duplicate side effects unless explicitly invoked with idempotency key
      },
    },
  });
}

/**
 * Purges all private user-scoped cache entries upon logout or user switch.
 */
export function purgePrivateQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ['favorites'] });
  queryClient.removeQueries({ queryKey: ['profile'] });
  queryClient.removeQueries({ queryKey: ['wallets'] });
  queryClient.removeQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['cart'] });
}
