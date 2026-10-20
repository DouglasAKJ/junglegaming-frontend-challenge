import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/ui/toast-provider';
import { EditionType } from '@/types/contracts';

export function useCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const userId = user?.id || null;
  const cartKey = queryKeys.cart(userId);

  const cartQuery = useQuery({
    queryKey: cartKey,
    queryFn: ({ signal }) => api.cart.get(signal),
    staleTime: 1000 * 10,
  });

  const addItemMutation = useMutation({
    mutationFn: (input: { nftId: string; edition?: EditionType; quantity?: number }) =>
      api.cart.addItem(input),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
      addToast({
        title: 'Adicionado ao carrinho',
        description: 'O NFT foi incluído na sua carteira de compras.',
        variant: 'success',
      });
    },
    onError: (err) => {
      const msg =
        err instanceof AppApiError
          ? err.message
          : 'Não foi possível adicionar o item ao carrinho.';
      addToast({
        title: 'Erro ao adicionar item',
        description: msg,
        variant: 'danger',
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({
      itemId,
      quantity,
      acknowledgeChanges,
    }: {
      itemId: string;
      quantity: number;
      acknowledgeChanges?: boolean;
    }) => api.cart.updateItemQuantity(itemId, quantity, acknowledgeChanges),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
    },
    onError: (err) => {
      const msg =
        err instanceof AppApiError
          ? err.message
          : 'Não foi possível alterar a quantidade.';
      addToast({
        title: 'Limite de disponibilidade',
        description: msg,
        variant: 'warning',
      });
      queryClient.invalidateQueries({ queryKey: cartKey });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => api.cart.removeItem(itemId),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
      addToast({
        title: 'Item removido',
        description: 'O NFT foi removido do carrinho.',
        variant: 'info',
      });
    },
  });

  const applyCouponMutation = useMutation({
    mutationFn: (code: string) => api.cart.applyCoupon(code),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
      addToast({
        title: 'Cupom aplicado!',
        description: `Desconto de ${data.discountPercent}% calculado na cotação.`,
        variant: 'success',
      });
    },
  });

  const removeCouponMutation = useMutation({
    mutationFn: () => api.cart.removeCoupon(),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
      addToast({
        title: 'Cupom removido',
        description: 'Os valores foram recalculados sem o código promocional.',
        variant: 'info',
      });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => api.cart.acknowledgeChanges(),
    onSuccess: (data) => {
      queryClient.setQueryData(cartKey, data);
    },
  });

  const items = cartQuery.data?.items || [];
  const totalItemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const hasRealtimeChanges = items.some((i) => i.priceChanged || i.stockChanged);

  return {
    cart: cartQuery.data,
    items,
    totalItemsCount,
    hasRealtimeChanges,
    isLoading: cartQuery.isLoading,
    isFetching: cartQuery.isFetching,
    isError: cartQuery.isError,
    refetch: cartQuery.refetch,
    addItem: addItemMutation.mutateAsync,
    isAdding: addItemMutation.isPending,
    updateQuantity: updateQuantityMutation.mutateAsync,
    isUpdating: updateQuantityMutation.isPending,
    removeItem: removeItemMutation.mutateAsync,
    applyCoupon: applyCouponMutation.mutateAsync,
    isApplyingCoupon: applyCouponMutation.isPending,
    removeCoupon: removeCouponMutation.mutateAsync,
    acknowledgeChanges: acknowledgeMutation.mutateAsync,
  };
}
