import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/ui/toast-provider';

export function useFavorites() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const userId = user?.id || null;

  const favoritesQuery = useQuery({
    queryKey: queryKeys.favorites(userId),
    queryFn: ({ signal }) => api.favorites.list(signal),
    enabled: isAuthenticated && Boolean(userId),
    staleTime: 1000 * 30,
  });

  const favoriteIds = isAuthenticated ? favoritesQuery.data?.nftIds || [] : [];

  const toggleMutation = useMutation({
    mutationFn: async ({ nftId, isCurrentlyFav }: { nftId: string; isCurrentlyFav: boolean }) => {
      if (isCurrentlyFav) {
        return api.favorites.remove(nftId);
      }
      return api.favorites.add(nftId);
    },
    onMutate: async ({ nftId, isCurrentlyFav }) => {
      const qKey = queryKeys.favorites(userId);
      await queryClient.cancelQueries({ queryKey: qKey });

      const previous = queryClient.getQueryData<{ nftIds: string[] }>(qKey);
      const currentList = previous?.nftIds || [];

      const optimisticList = isCurrentlyFav
        ? currentList.filter((id) => id !== nftId)
        : [...currentList, nftId];

      queryClient.setQueryData<{ nftIds: string[] }>(qKey, {
        nftIds: optimisticList,
      });

      return { previous };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.favorites(userId), data);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.favorites(userId), context.previous);
      }
      const message =
        err instanceof AppApiError
          ? err.message
          : 'Não foi possível atualizar os favoritos. Estado restaurado.';
      addToast({
        title: 'Falha ao atualizar favorito',
        description: message,
        variant: 'danger',
      });
    },
  });

  const toggleFavorite = (nftId: string) => {
    if (!isAuthenticated) {
      openAuthModal({
        mode: 'login',
        reason: 'Entre na sua conta para salvar NFTs na sua lista de favoritos.',
      });
      return;
    }
    const isCurrentlyFav = favoriteIds.includes(nftId);
    toggleMutation.mutate({ nftId, isCurrentlyFav });
  };

  return {
    favoriteIds,
    isFavorite: (nftId: string) => favoriteIds.includes(nftId),
    toggleFavorite,
    isPending: toggleMutation.isPending,
  };
}
