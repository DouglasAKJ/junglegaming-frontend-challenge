import React from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, ShoppingCart, Search } from 'lucide-react';
import { NftItem } from '@/types/contracts';
import { useFavorites } from '@/features/favorites/use-favorites';
import { useCart } from '@/features/cart/use-cart';
import { socketManager } from '@/lib/socket';

interface NftCardProps {
  nft: NftItem;
}

export function NftCard({ nft }: NftCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem, isAdding } = useCart();

  React.useEffect(() => {
    socketManager.seedNftVersion(nft.id, nft.version);
  }, [nft.id, nft.version]);

  const fav = isFavorite(nft.id);

  const handleQuickAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await addItem({
      nftId: nft.id,
      edition: nft.defaultEdition,
      quantity: 1,
    });
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(nft.id);
  };

  return (
    <article
      data-testid={`nft-card-${nft.id}`}
      className="group relative flex flex-col rounded-xl bg-[#241612]/60 border border-[#3f2319] hover:border-[#d28a4c]/70 transition-all p-2.5 sm:p-3"
    >
      {/* Artwork container */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#140d0a] mb-3">
        {nft.badge && (
          <span className="absolute top-0 left-0 z-10 bg-[#d28a4c] text-[#140d0a] text-[11px] font-bold px-3 py-1 rounded-br-lg">
            {nft.badge}
          </span>
        )}

        {/* Mobile/Always accessible Favorite button in top-right */}
        <button
          type="button"
          data-testid={`nft-fav-button-${nft.id}`}
          onClick={handleToggleFav}
          aria-label={
            fav
              ? `Remover ${nft.title} dos favoritos`
              : `Adicionar ${nft.title} aos favoritos`
          }
          aria-pressed={fav}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
            fav
              ? 'bg-[#d28a4c] border-[#d28a4c] text-[#140d0a]'
              : 'bg-[#241612]/85 border-[#55321f] text-[#d28a4c] hover:bg-[#2f1d15]'
          }`}
        >
          <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
        </button>

        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="block w-full h-full focus-visible:outline-none"
        >
          <img
            src={nft.image}
            alt={`Obra digital ${nft.title} da coleção ${nft.collectionName}`}
            loading="lazy"
            width={400}
            height={400}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* Hover Quick Action Bar matching Figma */}
        <div className="hidden sm:flex absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            data-testid={`nft-quick-cart-${nft.id}`}
            disabled={isAdding}
            onClick={handleQuickAddToCart}
            aria-label={`Adicionar ${nft.title} ao carrinho`}
            className="w-9 h-9 rounded-md bg-[#241612]/95 border border-[#55321f] text-[#f5f1eb] hover:text-[#d28a4c] hover:border-[#d28a4c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={
              fav
                ? `Desfavoritar ${nft.title}`
                : `Favoritar ${nft.title}`
            }
            className={`w-9 h-9 rounded-md bg-[#241612]/95 border border-[#55321f] flex items-center justify-center transition-colors cursor-pointer ${
              fav ? 'text-[#d28a4c]' : 'text-[#f5f1eb] hover:text-[#d28a4c]'
            }`}
          >
            <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
          </button>
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Ver detalhes de ${nft.title}`}
            className="w-9 h-9 rounded-md bg-[#241612]/95 border border-[#55321f] text-[#f5f1eb] hover:text-[#d28a4c] hover:border-[#d28a4c] flex items-center justify-center transition-colors"
          >
            <Search className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Info Footer */}
      <div className="flex flex-col gap-1 px-0.5">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          data-testid={`nft-title-link-${nft.id}`}
          className="text-sm font-normal text-[#f5f1eb] hover:text-[#d28a4c] transition-colors truncate"
        >
          {nft.title}
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span
            data-testid={`nft-price-${nft.id}`}
            className="font-bold text-[#e89b55]"
          >
            {nft.priceEth} ETH
          </span>
          {nft.originalPriceEth && (
            <span className="text-xs text-[#b39463] line-through">
              {nft.originalPriceEth} ETH
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
