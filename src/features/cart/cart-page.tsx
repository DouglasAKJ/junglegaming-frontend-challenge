import React, { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Trash2,
  Minus,
  Plus,
  ChevronLeft,
  AlertTriangle,
  Tag,
  X,
} from 'lucide-react';
import { useCart } from './use-cart';
import { useAuth } from '@/features/auth/auth-context';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { CartSummarySkeleton, Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { NftCard } from '@/features/catalog/nft-card';

export function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();
  const {
    cart,
    items,
    hasRealtimeChanges,
    isLoading,
    updateQuantity,
    removeItem,
    applyCoupon,
    isApplyingCoupon,
    removeCoupon,
    acknowledgeChanges,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const recommendedQuery = useQuery({
    queryKey: queryKeys.nfts.list({ limit: 5 }),
    queryFn: ({ signal }) => api.nfts.list({ limit: 5 }, signal),
  });

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!couponInput.trim()) {
      setCouponError('Digite um código promocional');
      return;
    }
    try {
      await applyCoupon(couponInput.trim());
      setCouponInput('');
    } catch (err) {
      if (err instanceof AppApiError) {
        setCouponError(err.message);
      } else {
        setCouponError('Não foi possível validar o cupom.');
      }
    }
  };

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      openAuthModal({
        mode: 'login',
        redirectTo: '/pagamento',
        reason: 'Autentique-se para conectar sua carteira e finalizar a compra.',
      });
      return;
    }
    navigate({ to: '/pagamento' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      {/* Desktop Breadcrumb & Mobile Header */}
      <div className="mb-6">
        <nav
          aria-label="Breadcrumb"
          className="hidden md:flex items-center gap-2 text-xs mb-2"
        >
          <Link to="/" className="font-bold text-[#f5f1eb] hover:text-[#d28a4c]">
            Início
          </Link>
          <span className="text-[#cfb28c]">/</span>
          <Link to="/" className="font-bold text-[#f5f1eb] hover:text-[#d28a4c]">
            Mercado
          </Link>
          <span className="text-[#cfb28c]">/</span>
          <span className="font-bold text-[#f5f1eb]">Carrinho</span>
        </nav>

        <div className="flex md:hidden items-center gap-4">
          <Link
            to="/"
            aria-label="Voltar para o catálogo"
            className="w-10 h-10 rounded-full bg-[#241612] border border-[#3f2319] flex items-center justify-center text-[#d28a4c]"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-[#f5f1eb]">Carrinho de NFTs</h1>
        </div>
      </div>

      {/* Real-time Price or Stock Change Banner */}
      {hasRealtimeChanges && (
        <div
          role="alert"
          data-testid="cart-realtime-alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e89b55] bg-[#2f1d15] p-4 text-xs text-[#f5f1eb]"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#e89b55] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-[#e89b55]">
                Preços ou disponibilidade foram atualizados em tempo real
              </p>
              <p className="text-[#cfb28c] mt-0.5">
                O resumo da carteira foi recalculado automaticamente com a cotação mais recente da API.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="cart-acknowledge-changes"
            onClick={() => acknowledgeChanges()}
          >
            Ciente dos novos valores
          </Button>
        </div>
      )}

      {/* Main Cart Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-4">
            <CartSummarySkeleton />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div
          data-testid="cart-empty-state"
          className="rounded-2xl bg-[#241612]/60 border border-[#3f2319] p-12 text-center space-y-4 my-4"
        >
          <h2 className="text-lg font-bold text-[#f5f1eb]">
            Seu carrinho de NFTs está vazio
          </h2>
          <p className="text-xs text-[#cfb28c] max-w-md mx-auto">
            Explore o catálogo da Kurio para adicionar edições digitais verificadas à sua coleção.
          </p>
          <Link
            to="/"
            data-testid="cart-empty-explore-link"
            className="inline-flex items-center justify-center rounded-md bg-[#d28a4c] px-6 py-3 text-xs font-bold text-[#140d0a] hover:bg-[#e89b55]"
          >
            Continuar explorando
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Items Table (Desktop) & Cards (Mobile) */}
          <div className="lg:col-span-8">
            {/* Desktop Table Header matching Figma */}
            <div className="hidden md:grid grid-cols-12 gap-4 pb-3 mb-3 border-b border-[#3f2319] text-xs font-bold text-[#f5f1eb]">
              <div className="col-span-5">NFTs</div>
              <div className="col-span-2 text-center">Preço</div>
              <div className="col-span-2 text-center">Edições</div>
              <div className="col-span-2 text-center">Total</div>
              <div className="col-span-1 text-right">
                <span className="sr-only">Ações</span>
              </div>
            </div>

            <div className="space-y-3" data-testid="cart-items-list">
              {items.map((item) => {
                const outOfStock = item.available < item.quantity;
                return (
                  <div
                    key={item.id}
                    data-testid={`cart-item-${item.nftId}`}
                    className={`rounded-xl bg-[#241612]/90 border p-3.5 transition-colors ${
                      item.priceChanged || outOfStock
                        ? 'border-[#e89b55]'
                        : 'border-[#3f2319]'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      {/* Item Info */}
                      <div className="md:col-span-5 flex items-center gap-3.5">
                        <Link
                          to="/nft/$nftId"
                          params={{ nftId: item.nftId }}
                          className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-[#3f2319]"
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/nft/$nftId"
                            params={{ nftId: item.nftId }}
                            className="text-sm font-bold text-[#f5f1eb] hover:text-[#d28a4c] block truncate"
                          >
                            {item.title}
                          </Link>
                          <p className="text-xs text-[#b39463]">
                            ID do token: {item.tokenId} • Edição: {item.edition}
                          </p>
                          {item.priceChanged && (
                            <p className="text-[11px] text-[#e89b55] mt-0.5">
                              Preço atualizado ({item.previousPriceEth} → {item.unitPriceEth} ETH)
                            </p>
                          )}
                          {outOfStock && (
                            <p className="text-[11px] text-[#f0805f] mt-0.5">
                              Disponibilidade reduzida ({item.available} disponíveis)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Unit Price */}
                      <div className="hidden md:block md:col-span-2 text-center text-xs text-[#cfb28c]">
                        {item.unitPriceEth} ETH
                      </div>

                      {/* Quantity Controls */}
                      <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-3">
                        <span className="md:hidden text-sm font-bold text-[#e89b55]">
                          {item.lineTotalEth} ETH
                        </span>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            data-testid={`cart-qty-decrease-${item.nftId}`}
                            onClick={() =>
                              updateQuantity({
                                itemId: item.id,
                                quantity: item.quantity - 1,
                                acknowledgeChanges: true,
                              })
                            }
                            aria-label={`Diminuir quantidade de ${item.title}`}
                            className="w-6 h-8 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center hover:bg-[#e89b55] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <span
                            data-testid={`cart-qty-value-${item.nftId}`}
                            className="min-w-5 text-center text-xs font-bold text-[#f5f1eb]"
                          >
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            data-testid={`cart-qty-increase-${item.nftId}`}
                            disabled={item.quantity >= item.available}
                            onClick={() =>
                              updateQuantity({
                                itemId: item.id,
                                quantity: item.quantity + 1,
                                acknowledgeChanges: true,
                              })
                            }
                            aria-label={`Aumentar quantidade de ${item.title}`}
                            className="w-6 h-8 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold flex items-center justify-center hover:bg-[#e89b55] disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>

                          {/* Mobile Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remover ${item.title} do carrinho`}
                            className="md:hidden ml-2 text-[#b39463] hover:text-[#f0805f] p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Line Total (Desktop) */}
                      <div
                        data-testid={`cart-line-total-${item.nftId}`}
                        className="hidden md:block md:col-span-2 text-center text-xs font-bold text-[#e89b55]"
                      >
                        {item.lineTotalEth} ETH
                      </div>

                      {/* Remove Icon (Desktop) */}
                      <div className="hidden md:flex md:col-span-1 justify-end">
                        <button
                          type="button"
                          data-testid={`cart-remove-${item.nftId}`}
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remover ${item.title} do carrinho`}
                          className="text-[#b39463] hover:text-[#f0805f] p-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Resumo da carteira matching Figma */}
          <aside
            aria-label="Resumo da carteira"
            className="lg:col-span-4 space-y-5"
          >
            <div className="border-b border-[#3f2319] pb-3">
              <h2 className="text-base font-bold text-[#f5f1eb]">
                Resumo da carteira
              </h2>
            </div>

            {/* Promotional Code Form */}
            <div>
              <label
                htmlFor="cart-coupon-input"
                className="block text-xs font-bold text-[#f5f1eb] mb-2"
              >
                Código promocional
              </label>
              <form onSubmit={handleApplyCoupon} className="flex">
                <input
                  id="cart-coupon-input"
                  data-testid="cart-coupon-input"
                  type="text"
                  placeholder="Digite o código promocional..."
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 min-w-0 h-10 rounded-l-md border border-[#d28a4c]/60 bg-[#140d0a] px-3 text-xs text-[#f5f1eb] placeholder:text-[#b39463]"
                />
                <button
                  type="submit"
                  data-testid="cart-coupon-submit"
                  disabled={isApplyingCoupon}
                  className="h-10 px-4 rounded-r-md bg-[#d28a4c] text-[#140d0a] text-xs font-bold hover:bg-[#e89b55] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Aplicar
                </button>
              </form>
              {couponError && (
                <p
                  role="alert"
                  data-testid="cart-coupon-error"
                  className="mt-1.5 text-xs text-[#f0805f]"
                >
                  {couponError}
                </p>
              )}
              {cart?.couponCode && (
                <div
                  data-testid="cart-active-coupon"
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#241612] border border-[#d28a4c] px-3 py-1 text-xs text-[#d28a4c]"
                >
                  <Tag className="w-3 h-3" />
                  <span>
                    Cupom <strong>{cart.couponCode}</strong> (-{cart.discountPercent}%)
                  </span>
                  <button
                    type="button"
                    data-testid="cart-remove-coupon"
                    onClick={() => removeCoupon()}
                    aria-label="Remover cupom aplicado"
                    className="hover:text-[#f5f1eb] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-[11px] text-[#b39463] mt-1.5">
                Cupons de teste: <code className="text-[#cfb28c]">KURIO10</code> (10%),{' '}
                <code className="text-[#cfb28c]">EXPIRADO50</code> (expirado)
              </p>
            </div>

            {/* Values Breakdown */}
            <dl className="space-y-3 text-xs sm:text-sm pt-2">
              <div className="flex items-center justify-between">
                <dt className="text-[#f5f1eb]">Subtotal</dt>
                <dd
                  data-testid="cart-subtotal"
                  className="font-medium text-[#f5f1eb]"
                >
                  {cart?.subtotalEth || '0.00'} ETH
                </dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-[#f5f1eb]">Desconto do lançamento</dt>
                <dd
                  data-testid="cart-discount"
                  className="font-medium text-[#f5f1eb]"
                >
                  (-) {cart?.discountEth || '0.00'}
                </dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-[#f5f1eb]">Taxa de rede</dt>
                <dd
                  data-testid="cart-network-fee"
                  className="font-medium text-[#f5f1eb]"
                >
                  {cart?.networkFeeEth || '0.016'} ETH
                </dd>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-[#d28a4c]">Taxa estimada</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#3f2319] text-base font-bold">
                <dt className="text-[#f5f1eb]">Total</dt>
                <dd data-testid="cart-total" className="text-[#e89b55]">
                  {cart?.totalEth || '0.00'} ETH
                </dd>
              </div>
            </dl>

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                data-testid="cart-checkout-button"
                onClick={handleProceedToCheckout}
                className="w-full h-11 text-xs sm:text-sm font-bold"
              >
                Conectar e finalizar
              </Button>

              <div className="text-center">
                <Link
                  to="/"
                  className="text-xs text-[#d28a4c] hover:underline font-medium"
                >
                  Continuar explorando
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Colecionadores também viram matching Figma */}
      {recommendedQuery.data && recommendedQuery.data.items.length > 0 && (
        <section aria-label="Colecionadores também viram" className="mt-16">
          <div className="border-b border-[#3f2319] pb-3 mb-6">
            <h2 className="text-sm sm:text-base font-bold text-[#d28a4c]">
              Colecionadores também viram
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {recommendedQuery.data.items.slice(0, 5).map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
