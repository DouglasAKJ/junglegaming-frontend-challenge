import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  Star,
  Minus,
  Plus,
  ShoppingCart,
  ChevronLeft,
  AlertTriangle,
  Share2,
  ZoomIn,
} from 'lucide-react';
import { EditionType, NftItem } from '@/types/contracts';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { mulEth } from '@/lib/eth';
import { socketManager } from '@/lib/socket';
import { useFavorites } from '@/features/favorites/use-favorites';
import { useCart } from '@/features/cart/use-cart';
import { NftDetailSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { NftCard } from './nft-card';
import { useToast } from '@/components/ui/toast-provider';

const EMERALD_APE_PLACEHOLDER: NftItem = {
  id: 'emerald-ape-042',
  tokenId: '#0042',
  title: 'Emerald Ape #042',
  collectionName: 'Kurio Apes',
  category: 'Arte digital',
  network: 'Ethereum',
  priceEth: '1.19',
  image: '/assets/nfts/ape-emerald.png',
  gallery: [
    '/assets/nfts/ape-emerald.png',
    '/assets/nfts/ape-emerald.png',
    '/assets/nfts/ape-emerald.png',
    '/assets/nfts/ape-emerald.png',
  ],
  isFeatured: true,
  isNewRelease: true,
  isTrending: true,
  rating: 4.8,
  reviewsCount: 19,
  reviews: [
    {
      id: 'rev-1',
      author: 'nova.kurio.eth',
      rating: 5,
      comment:
        'Acabamento impecável e metadados verificados no IPFS. Uma peça essencial da coleção Kurio Editions.',
      date: '2026-07-15',
    },
    {
      id: 'rev-2',
      author: 'kai.collector.eth',
      rating: 5,
      comment: 'A paleta esmeralda e os óculos retrô destacam muito na galeria.',
      date: '2026-07-18',
    },
  ],
  shortDescription:
    'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
  fullDescription:
    'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\nA propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
  creator: 'Nova Sato',
  royaltyPercent: 5,
  contractAddress: '0x7A42...19E8',
  attributes: ['Óculos', 'Esmeralda', 'Raro'],
  defaultEdition: '1/50',
  editions: [
    { edition: '1/1', priceEth: '3.50', available: 1, totalSupply: 1 },
    { edition: '1/10', priceEth: '1.89', available: 4, totalSupply: 10 },
    { edition: '1/50', priceEth: '1.19', available: 15, totalSupply: 50 },
    { edition: 'ABERTA', priceEth: '0.79', available: 100, totalSupply: 200 },
  ],
  createdAt: '2026-07-28T10:00:00.000Z',
  version: 1,
};

export function NftDetailPage({ nftId }: { nftId: string }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem, isAdding } = useCart();

  const detailQuery = useQuery({
    queryKey: queryKeys.nfts.detail(nftId),
    queryFn: ({ signal }) => api.nfts.getById(nftId, signal),
    placeholderData:
      nftId === 'emerald-ape-042' ? EMERALD_APE_PLACEHOLDER : undefined,
  });

  const relatedQuery = useQuery({
    queryKey: queryKeys.nfts.list({ limit: 6 }),
    queryFn: ({ signal }) => api.nfts.list({ limit: 6 }, signal),
    enabled: !detailQuery.isPlaceholderData && !detailQuery.isLoading,
  });

  const nft = detailQuery.data;

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedEdition, setSelectedEdition] = useState<EditionType>('1/50');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');

  useEffect(() => {
    if (nft) {
      socketManager.seedNftVersion(nft.id, nft.version);
      setSelectedEdition(nft.defaultEdition);
      setSelectedImageIdx(0);
      setQuantity(1);
    }
  }, [nft?.id]);

  // Clamp quantity if edition availability changes in real time
  const currentEditionInfo =
    nft?.editions.find((e) => e.edition === selectedEdition) ||
    nft?.editions[0];

  const maxAvailable = currentEditionInfo?.available ?? 0;

  useEffect(() => {
    if (maxAvailable > 0 && quantity > maxAvailable) {
      setQuantity(maxAvailable);
    } else if (maxAvailable === 0) {
      setQuantity(1);
    }
  }, [maxAvailable, quantity]);

  if (detailQuery.isLoading) {
    return <NftDetailSkeleton nftId={nftId} />;
  }

  if (detailQuery.isError || !nft) {
    const isNotFound =
      detailQuery.error instanceof AppApiError &&
      detailQuery.error.status === 404;

    return (
      <div
        role="alert"
        data-testid="nft-detail-error"
        className="max-w-3xl mx-auto px-4 py-16 text-center space-y-5"
      >
        <AlertTriangle className="w-12 h-12 text-[#f0805f] mx-auto" />
        <h1 className="text-2xl font-bold text-[#f5f1eb]">
          {isNotFound ? 'NFT não encontrado' : 'Erro ao carregar detalhes do NFT'}
        </h1>
        <p className="text-xs sm:text-sm text-[#cfb28c] max-w-md mx-auto">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : 'Este colecionável não existe ou não pôde ser carregado.'}
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            to="/"
            data-testid="back-to-catalog-link"
            className="inline-flex items-center gap-2 rounded-md bg-[#d28a4c] px-5 py-2.5 text-xs font-bold text-[#140d0a] hover:bg-[#e89b55]"
          >
            Voltar ao catálogo
          </Link>
          {!isNotFound && (
            <Button
              type="button"
              variant="outline"
              onClick={() => detailQuery.refetch()}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  const fav = isFavorite(nft.id);
  const unitPrice = currentEditionInfo?.priceEth || nft.priceEth;
  const totalPreviewEth = mulEth(unitPrice, quantity);
  const isEditionOut = maxAvailable <= 0;

  const handleBuyClick = async (goToCart = false) => {
    if (isEditionOut) return;
    try {
      await addItem({
        nftId: nft.id,
        edition: selectedEdition,
        quantity,
      });
      if (goToCart) {
        navigate({ to: '/carrinho' });
      }
    } catch {
      // Error toast already handled in useCart
    }
  };

  const relatedItems = (relatedQuery.data?.items || [])
    .filter((i) => i.id !== nft.id)
    .slice(0, 5);

  const gallery = nft.gallery?.length > 0 ? nft.gallery : [nft.image];
  const activeImage = gallery[selectedImageIdx] || nft.image;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      {/* Breadcrumb (Desktop) & Back Header (Mobile) */}
      <div className="flex items-center justify-between mb-6">
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-xs">
          <Link to="/" className="font-bold text-[#f5f1eb] hover:text-[#d28a4c]">
            Início
          </Link>
          <span className="text-[#cfb28c]">/</span>
          <Link to="/" className="font-bold text-[#f5f1eb] hover:text-[#d28a4c]">
            Mercado
          </Link>
        </nav>

        <div className="flex md:hidden items-center justify-between w-full">
          <Link
            to="/"
            aria-label="Voltar para o catálogo"
            className="w-10 h-10 rounded-full bg-[#241612] border border-[#3f2319] flex items-center justify-center text-[#d28a4c]"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <button
            type="button"
            onClick={() => toggleFavorite(nft.id)}
            aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            aria-pressed={fav}
            className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer ${
              fav
                ? 'bg-[#d28a4c] border-[#d28a4c] text-[#140d0a]'
                : 'bg-[#241612] border-[#3f2319] text-[#d28a4c]'
            }`}
          >
            <Heart className={`w-5 h-5 ${fav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Top Section: Gallery + Purchase Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left: Thumbnails + Main Artwork */}
        <div className="lg:col-span-6 flex flex-col-reverse sm:flex-row gap-4">
          <div
            role="group"
            aria-label="Galeria de miniaturas do NFT"
            className="flex sm:flex-col gap-3 overflow-x-auto sm:w-20 shrink-0"
          >
            {gallery.map((imgUrl, idx) => {
              const isSelected = idx === selectedImageIdx;
              return (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  data-testid={`gallery-thumb-${idx}`}
                  onClick={() => setSelectedImageIdx(idx)}
                  aria-label={`Ver imagem ${idx + 1} da galeria`}
                  aria-pressed={isSelected}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'border-[#d28a4c] scale-[1.02]'
                      : 'border-[#3f2319] opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${nft.title} miniatura ${idx + 1}`}
                    loading="lazy"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 aspect-square rounded-2xl bg-[#241612] border border-[#3f2319] p-3 sm:p-4 overflow-hidden">
            <img
              data-testid="nft-detail-main-image"
              src={activeImage}
              alt={nft.title}
              fetchPriority="high"
              width={600}
              height={600}
              className="w-full h-full object-cover rounded-xl"
            />
            <span
              aria-hidden="true"
              className="hidden sm:flex absolute top-6 right-6 w-8 h-8 rounded-full bg-[#140d0a]/70 text-[#f5f1eb] items-center justify-center"
            >
              <ZoomIn className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Right: Title, Price, Editions, Quantity, Buy & Favorite */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1
                data-testid="nft-detail-title"
                className="text-2xl sm:text-3xl font-bold text-[#f5f1eb]"
              >
                {nft.title}
              </h1>

              {/* Mobile Rating Pill matching Figma Mobile / Detalhes do NFT */}
              <div className="inline-flex md:hidden items-center gap-1 rounded-full border border-[#d28a4c] px-2.5 py-1 text-xs font-bold text-[#f5f1eb]">
                <Star className="w-3.5 h-3.5 text-[#d28a4c] fill-current" />
                <span>{nft.rating}</span>
                <span className="text-[#cfb28c]">({nft.reviewsCount})</span>
              </div>
            </div>

            {/* Desktop Price & Ratings Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#3f2319]">
              <span
                data-testid={
                  detailQuery.isPlaceholderData ? undefined : 'nft-detail-price'
                }
                className="text-xl sm:text-2xl font-bold text-[#e89b55]"
              >
                {unitPrice} ETH
              </span>

              <div className="hidden md:flex items-center gap-2 text-xs text-[#f5f1eb]">
                <div className="flex items-center text-[#d28a4c]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < 4 ? 'fill-current' : ''}`}
                    />
                  ))}
                </div>
                <span>{nft.reviewsCount} avaliações de colecionadores</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xs font-bold text-[#f5f1eb]">Sobre este NFT:</h2>
              <p className="text-xs sm:text-sm text-[#cfb28c] leading-relaxed">
                {nft.shortDescription}
              </p>
            </div>

            {/* Edition Selector matching Figma: 1/1 | 1/10 | 1/50 | ABERTA */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#f5f1eb]">Edição:</span>
                <span
                  data-testid="nft-edition-availability"
                  className={`text-xs font-medium ${
                    isEditionOut ? 'text-[#f0805f]' : 'text-[#cfb28c]'
                  }`}
                >
                  {isEditionOut
                    ? 'Edição esgotada'
                    : `${maxAvailable} de ${currentEditionInfo?.totalSupply || maxAvailable} disponíveis`}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Selecionar edição do NFT"
                className="flex flex-wrap items-center gap-2.5"
              >
                {nft.editions.map((ed) => {
                  const isSelected = ed.edition === selectedEdition;
                  const unavailable = ed.available <= 0;
                  return (
                    <button
                      key={ed.edition}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      data-testid={`edition-option-${ed.edition}`}
                      onClick={() => {
                        setSelectedEdition(ed.edition);
                        setQuantity(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#d28a4c] text-[#d28a4c] bg-[#241612]'
                          : unavailable
                            ? 'border-[#3f2319] text-[#b39463]/45 line-through bg-[#140d0a]'
                            : 'border-[#3f2319] text-[#cfb28c] hover:border-[#b39463]'
                      }`}
                    >
                      {ed.edition}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity + COMPRAR + Favoritar row matching Figma */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  data-testid="detail-qty-decrease"
                  disabled={quantity <= 1 || isEditionOut}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                  className="w-7 h-10 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center hover:bg-[#e89b55] disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span
                  data-testid="detail-qty-value"
                  aria-live="polite"
                  className="min-w-6 text-center text-sm font-bold text-[#f5f1eb]"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  data-testid="detail-qty-increase"
                  disabled={isEditionOut || quantity >= maxAvailable}
                  onClick={() =>
                    setQuantity((q) => Math.min(maxAvailable, q + 1))
                  }
                  aria-label="Aumentar quantidade"
                  className="w-7 h-10 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center hover:bg-[#e89b55] disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <Button
                type="button"
                data-testid="detail-buy-button"
                disabled={isEditionOut || isAdding}
                onClick={() => handleBuyClick(false)}
                className="px-7 uppercase tracking-wide"
              >
                {isEditionOut
                  ? 'ESGOTADO'
                  : isAdding
                    ? 'ADICIONANDO...'
                    : 'COMPRAR'}
              </Button>

              <Button
                type="button"
                data-testid="detail-favorite-button"
                variant="outline"
                onClick={() => toggleFavorite(nft.id)}
                aria-pressed={fav}
                className={
                  fav
                    ? 'border-[#d28a4c] bg-[#241612] text-[#d28a4c]'
                    : 'border-[#55321f] text-[#cfb28c]'
                }
              >
                <Heart className={`w-4 h-4 ${fav ? 'fill-current text-[#d28a4c]' : ''}`} />
                <span>{fav ? 'Favoritado' : 'Favoritar'}</span>
              </Button>
            </div>

            {quantity > 1 && !isEditionOut && (
              <p className="text-xs text-[#cfb28c]">
                Total para {quantity} edições:{' '}
                <span className="font-bold text-[#e89b55]">{totalPreviewEth} ETH</span>
              </p>
            )}

            {/* Metadata list matching Figma */}
            <dl className="space-y-1.5 pt-2 text-xs text-[#cfb28c]">
              <div className="flex gap-2">
                <dt className="text-[#b39463]">ID do token:</dt>
                <dd className="text-[#f5f1eb]">{nft.tokenId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[#b39463]">Coleção:</dt>
                <dd className="text-[#f5f1eb]">{nft.collectionName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[#b39463]">Atributos:</dt>
                <dd className="text-[#f5f1eb]">{nft.attributes.join(', ')}</dd>
              </div>
            </dl>

            <div className="flex items-center gap-3 pt-1 text-xs text-[#f5f1eb]">
              <span className="font-bold">Compartilhar este NFT:</span>
              {['LinkedIn', 'E-mail', 'Twitter'].map((channel) => (
                <button
                  key={channel}
                  type="button"
                  aria-label={`Compartilhar via ${channel}`}
                  onClick={() =>
                    addToast({
                      title: 'Link copiado para compartilhamento',
                      description: `URL de ${nft.title} pronta para compartilhar no ${channel}.`,
                      variant: 'info',
                    })
                  }
                  className="text-[#cfb28c] hover:text-[#d28a4c] p-1 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar matching Mobile / Detalhes do NFT */}
      <div className="md:hidden mt-6 rounded-2xl bg-[#241612] border border-[#3f2319] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#cfb28c]">Qtd.</span>
            <button
              type="button"
              disabled={quantity <= 1 || isEditionOut}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-6 h-8 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center disabled:opacity-40"
            >
              -
            </button>
            <span className="text-sm font-bold text-[#f5f1eb]">{quantity}</span>
            <button
              type="button"
              disabled={isEditionOut || quantity >= maxAvailable}
              onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
              className="w-6 h-8 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center disabled:opacity-40"
            >
              +
            </button>
          </div>
          <span className="text-lg font-bold text-[#e89b55]">
            {totalPreviewEth} ETH
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={isEditionOut || isAdding}
            onClick={() => handleBuyClick(true)}
            className="flex-1 rounded-full h-12 text-sm font-bold"
          >
            {isEditionOut ? 'Edição Esgotada' : 'Comprar NFT'}
          </Button>
          <button
            type="button"
            disabled={isEditionOut || isAdding}
            onClick={() => handleBuyClick(false)}
            aria-label="Adicionar ao carrinho"
            className="w-12 h-12 rounded-full border border-[#55321f] bg-[#140d0a] text-[#d28a4c] flex items-center justify-center disabled:opacity-40"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs: Detalhes do NFT | Avaliações de colecionadores */}
      <section aria-label="Informações detalhadas do NFT" className="mt-12">
        <div
          role="tablist"
          className="flex items-center gap-8 border-b border-[#3f2319] mb-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            onClick={() => setActiveTab('details')}
            className={`relative pb-3 text-sm transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'text-[#d28a4c] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#d28a4c]'
                : 'text-[#f5f1eb] hover:text-[#cfb28c]'
            }`}
          >
            Detalhes do NFT
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reviews'}
            onClick={() => setActiveTab('reviews')}
            className={`relative pb-3 text-sm transition-colors cursor-pointer ${
              activeTab === 'reviews'
                ? 'text-[#d28a4c] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#d28a4c]'
                : 'text-[#f5f1eb] hover:text-[#cfb28c]'
            }`}
          >
            Avaliações de colecionadores ({nft.reviewsCount})
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="space-y-5 text-xs sm:text-sm text-[#cfb28c] leading-relaxed max-w-5xl">
            {nft.fullDescription.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}

            <div className="space-y-3 pt-2">
              <div>
                <h3 className="font-bold text-[#f5f1eb]">Rede:</h3>
                <p>
                  Cunhado na {nft.network} com procedência imutável e metadados armazenados no IPFS.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#f5f1eb]">Contrato:</h3>
                <p>
                  Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-[#f5f1eb]">Direitos autorais:</h3>
                <p>{nft.contractAddress} • Contrato inteligente ERC-721 verificado.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {nft.reviews.length === 0 ? (
              <p className="text-xs text-[#cfb28c]">
                Este NFT possui {nft.reviewsCount} avaliações verificadas na rede (média {nft.rating}/5.0).
              </p>
            ) : (
              nft.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-lg bg-[#241612] border border-[#3f2319] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#d28a4c]">{rev.author}</span>
                    <span className="text-[#b39463]">{rev.date}</span>
                  </div>
                  <p className="text-xs text-[#f5f1eb]">{rev.comment}</p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Mais desta coleção */}
      {relatedItems.length > 0 && (
        <section aria-label="Mais desta coleção" className="mt-14">
          <div className="border-b border-[#3f2319] pb-3 mb-6">
            <h2 className="text-sm sm:text-base font-bold text-[#d28a4c]">
              Mais desta coleção
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {relatedItems.map((item) => (
              <NftCard key={item.id} nft={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
