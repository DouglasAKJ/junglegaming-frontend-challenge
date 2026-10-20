import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import {
  CollectorCheckoutDetails,
  NetworkType,
  WalletProvider,
  OrderReceipt,
} from '@/types/contracts';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { socketManager } from '@/lib/socket';
import { useAuth } from '@/features/auth/auth-context';
import { useCart } from '@/features/cart/use-cart';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';

const PENDING_CHECKOUT_STORAGE_KEY = 'kurio_active_checkout_v1';

interface PersistedCheckoutSession {
  idempotencyKey: string;
  orderId: string | null;
  quoteHash: string | null;
  collector: CollectorCheckoutDetails;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const {
    cart,
    items,
    hasRealtimeChanges,
    acknowledgeChanges,
    applyCoupon,
    refetch: refetchCart,
  } = useCart();
  const { addToast } = useToast();

  const userId = user?.id || null;

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => api.wallets.list(signal),
    enabled: isAuthenticated && Boolean(userId),
  });

  const wallets = walletsQuery.data?.wallets || [];

  // Form fields matching Figma Desktop / Pagamento
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [network, setNetwork] = useState<NetworkType>('Ethereum');
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [walletAddress, setWalletAddress] = useState(
    '0xA91F234567890ABCDE1234567890ABCDEF12E82C'
  );
  const [secondaryWalletOrEns, setSecondaryWalletOrEns] = useState('nova.kurio.eth');
  const [walletProvider, setWalletProvider] =
    useState<WalletProvider>('Coinbase Wallet');
  const [referralCode, setReferralCode] = useState('KURIO2026');
  const [email, setEmail] = useState(user?.email || '');
  const [ensName, setEnsName] = useState(user?.ensName || 'nova.kurio');
  const [ensDomain, setEnsDomain] = useState<'.eth' | '.kurio.eth' | '.xyz'>('.eth');
  const [useAnotherWallet, setUseAnotherWallet] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  // Wallet connection simulation state
  const [walletConnectionStatus, setWalletConnectionStatus] = useState<
    'connected' | 'connecting' | 'rejected' | 'disconnected'
  >('connected');

  // Coupon inline toggle
  const [showCouponBox, setShowCouponBox] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');

  // Validation & Submission state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [quoteOutdatedBanner, setQuoteOutdatedBanner] = useState<string | null>(null);
  const [confirmedQuoteHash, setConfirmedQuoteHash] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [reviewStepOpen, setReviewStepOpen] = useState(false);

  // Sync user profile fields when session resolves on direct page load
  useEffect(() => {
    if (user) {
      setUsername((prev) => prev || user.username);
      setDisplayName((prev) => prev || user.displayName);
      setProfileName((prev) => prev || user.displayName);
      setEmail((prev) => prev || user.email);
      setEnsName((prev) => prev || user.ensName);
    }
  }, [user]);

  // Pre-fill from registered wallets when loaded
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      const primary = wallets.find((w) => w.kind === 'primary') || wallets[0];
      setSelectedWalletId(primary.id);
      setDisplayName(primary.displayName);
      if (user?.username) {
        setUsername((prev) => prev || user.username);
      }
      setNicknameOrProfile(primary.profileName, primary.address, primary.network, primary.provider);
      setReferralCode(primary.referralCode || 'KURIO2026');
      setEmail(primary.email || user?.email || '');
      setEnsName(primary.ensName || user?.ensName || 'nova.kurio');
      setEnsDomain(primary.ensDomain || '.eth');
      setSecondaryWalletOrEns(primary.secondaryEnsOrAddress || '');
    }
  }, [wallets, selectedWalletId, user]);

  function setNicknameOrProfile(
    pName: string,
    addr: string,
    net: NetworkType,
    prov: WalletProvider
  ) {
    setProfileName(pName);
    setWalletAddress(addr);
    setNetwork(net);
    setWalletProvider(prov);
  }

  // Restore any pending checkout across page refresh or reconnection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedCheckoutSession;
        if (saved.idempotencyKey) {
          setIdempotencyKey(saved.idempotencyKey);
        }
        if (saved.orderId) {
          setActiveOrderId(saved.orderId);
        }
        if (saved.collector) {
          setDisplayName(saved.collector.displayName);
          setUsername(saved.collector.username);
          setNetwork(saved.collector.network);
          setProfileName(saved.collector.profileName);
          setWalletAddress(saved.collector.walletAddress);
          setSecondaryWalletOrEns(saved.collector.secondaryWalletOrEns || '');
          setWalletProvider(saved.collector.walletProvider);
          setReferralCode(saved.collector.referralCode);
          setEmail(saved.collector.email);
          setEnsName(saved.collector.ensName);
          setEnsDomain(saved.collector.ensDomain);
          setUseAnotherWallet(saved.collector.useAnotherWallet);
          setNotes(saved.collector.notes || '');
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  // Track current cart quoteHash and detect if it changes while user is on Checkout
  useEffect(() => {
    if (!cart?.quoteHash) return;
    if (!confirmedQuoteHash) {
      setConfirmedQuoteHash(cart.quoteHash);
    } else if (confirmedQuoteHash !== cart.quoteHash || hasRealtimeChanges) {
      setQuoteOutdatedBanner(
        'O preço ou a disponibilidade de um ou mais itens mudou em tempo real. Revise o resumo atualizado e confirme que está de acordo antes de finalizar.'
      );
    }
  }, [cart?.quoteHash, confirmedQuoteHash, hasRealtimeChanges]);

  // Query active order if pending/created
  const activeOrderQuery = useQuery({
    queryKey: queryKeys.orders.detail(userId, activeOrderId || ''),
    queryFn: ({ signal }) => api.orders.getById(activeOrderId!, signal),
    enabled: Boolean(isAuthenticated && userId && activeOrderId),
    refetchInterval: (query) => {
      const data = query.state.data as OrderReceipt | undefined;
      if (data && data.status === 'pending') {
        return 1200; // Reconcile pending order automatically if socket disconnected
      }
      return false;
    },
  });

  const activeOrder = activeOrderQuery.data;

  // Navigate to confirmation receipt ONLY when order is effectively 'confirmed'
  useEffect(() => {
    if (activeOrder) {
      socketManager.seedOrderVersion(activeOrder.id, activeOrder.version);
      if (activeOrder.status === 'confirmed') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.cart(userId) });
        navigate({
          to: '/pedido/$orderId',
          params: { orderId: activeOrder.id },
        });
      } else if (activeOrder.status === 'declined') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        }
      }
    }
  }, [activeOrder, navigate, queryClient, userId]);

  const handleSelectRegisteredWallet = (walletId: string) => {
    const found = wallets.find((w) => w.id === walletId);
    if (!found) return;
    setSelectedWalletId(found.id);
    setDisplayName(found.displayName);
    setProfileName(found.profileName);
    setWalletAddress(found.address);
    setNetwork(found.network);
    setWalletProvider(found.provider);
    setReferralCode(found.referralCode);
    setEmail(found.email);
    setEnsName(found.ensName);
    setEnsDomain(found.ensDomain);
    setSecondaryWalletOrEns(found.secondaryEnsOrAddress || '');
    setWalletConnectionStatus('connected');
    // New selection gets a fresh idempotency key if not currently pending
    if (!activeOrderId || activeOrder?.status === 'declined') {
      setIdempotencyKey(generateIdempotencyKey());
      setActiveOrderId(null);
    }
  };

  const simulateWalletConnectAction = async (
    action: 'connect' | 'reject' | 'disconnect'
  ) => {
    if (action === 'connect') {
      setWalletConnectionStatus('connecting');
      await api.sim.updateConfig({ walletActionOutcome: 'success' });
      setTimeout(() => {
        setWalletConnectionStatus('connected');
        addToast({
          title: 'Carteira conectada',
          description: `${walletProvider} conectada na rede ${network}.`,
          variant: 'success',
        });
      }, 250);
    } else if (action === 'reject') {
      setWalletConnectionStatus('rejected');
      await api.sim.updateConfig({ walletActionOutcome: 'reject' });
      addToast({
        title: 'Assinatura recusada na carteira',
        description: 'Simulação de recusa da carteira ativada.',
        variant: 'warning',
      });
    } else {
      setWalletConnectionStatus('disconnected');
      await api.sim.updateConfig({ walletActionOutcome: 'disconnect' });
      addToast({
        title: 'Carteira desconectada',
        description: 'Reconecte sua carteira antes de confirmar a compra.',
        variant: 'danger',
      });
    }
  };

  const buildCollectorPayload = useCallback((): CollectorCheckoutDetails => {
    return {
      displayName: displayName.trim(),
      username: username.trim(),
      network,
      profileName: profileName.trim(),
      walletAddress: walletAddress.trim(),
      secondaryWalletOrEns: secondaryWalletOrEns.trim(),
      walletProvider,
      referralCode: referralCode.trim(),
      email: email.trim(),
      ensName: ensName.trim(),
      ensDomain,
      useAnotherWallet,
      notes: notes.trim(),
      selectedWalletId: selectedWalletId || undefined,
    };
  }, [
    displayName,
    username,
    network,
    profileName,
    walletAddress,
    secondaryWalletOrEns,
    walletProvider,
    referralCode,
    email,
    ensName,
    ensDomain,
    useAnotherWallet,
    notes,
    selectedWalletId,
  ]);

  const validateCollectorFields = (): boolean => {
    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      errs.displayName = 'Informe o nome de exibição';
    }
    if (username.trim().length < 2) {
      errs.username = 'Informe o nome de usuário';
    }
    if (profileName.trim().length < 2) {
      errs.profileName = 'Informe o nome do perfil';
    }
    if (
      !/^0x[a-fA-F0-9]{4,40}$|^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/.test(
        walletAddress.trim()
      )
    ) {
      errs.walletAddress = 'Informe um endereço 0x válido';
    }
    if (referralCode.trim().length < 2) {
      errs.referralCode = 'Informe o código de indicação';
    }
    if (!email.trim().includes('@')) {
      errs.email = 'Informe um e-mail válido';
    }
    if (ensName.trim().length < 2) {
      errs.ensName = 'Informe o nome ENS';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirmPurchase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submitting || activeOrder?.status === 'pending') {
      return; // Prevent duplicate clicks while in flight or pending
    }

    setSubmissionError(null);

    if (!isAuthenticated) {
      openAuthModal({
        mode: 'login',
        reason: 'Sua sessão expirou ou você não está autenticado. Entre para concluir o pedido sem perder os dados.',
      });
      return;
    }

    if (!validateCollectorFields()) {
      addToast({
        title: 'Campos obrigatórios pendentes',
        description: 'Verifique os campos destacados no perfil do colecionador.',
        variant: 'warning',
      });
      return;
    }

    if (quoteOutdatedBanner || hasRealtimeChanges) {
      setSubmissionError(
        'A cotação sofreu alterações em tempo real. Clique em "Confirmar novos valores" antes de enviar o pedido.'
      );
      return;
    }

    if (!cart || items.length === 0) {
      setSubmissionError('Seu carrinho está vazio.');
      return;
    }

    setSubmitting(true);
    const collector = buildCollectorPayload();

    try {
      // Persist checkout attempt in sessionStorage so refresh/timeout recovers the exact idempotencyKey
      if (typeof window !== 'undefined') {
        const persisted: PersistedCheckoutSession = {
          idempotencyKey,
          orderId: activeOrderId,
          quoteHash: cart.quoteHash,
          collector,
        };
        window.sessionStorage.setItem(
          PENDING_CHECKOUT_STORAGE_KEY,
          JSON.stringify(persisted)
        );
      }

      // 1. Revalidate quote against `/api/quote` before creating order
      const quoteCheck = await api.quote.validate({
        items: items.map((i) => ({
          nftId: i.nftId,
          edition: i.edition,
          quantity: i.quantity,
          expectedUnitPriceEth: i.unitPriceEth,
        })),
        couponCode: cart.couponCode,
        network,
      });

      if (!quoteCheck.valid || quoteCheck.quoteHash !== cart.quoteHash) {
        await refetchCart();
        setQuoteOutdatedBanner(
          quoteCheck.issues[0]?.message ||
            'Os valores ou a disponibilidade mudaram. Confirme a nova cotação para prosseguir.'
        );
        setSubmitting(false);
        return;
      }

      // 2. Submit idempotent order creation
      const createdOrder = await api.orders.create({
        idempotencyKey,
        quoteHash: quoteCheck.quoteHash,
        items: items.map((i) => ({
          nftId: i.nftId,
          edition: i.edition,
          quantity: i.quantity,
          unitPriceEth: i.unitPriceEth,
        })),
        couponCode: cart.couponCode,
        collector,
      });

      socketManager.seedOrderVersion(createdOrder.id, createdOrder.version);
      queryClient.setQueryData(
        queryKeys.orders.detail(userId, createdOrder.id),
        createdOrder
      );
      setActiveOrderId(createdOrder.id);

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          PENDING_CHECKOUT_STORAGE_KEY,
          JSON.stringify({
            idempotencyKey,
            orderId: createdOrder.id,
            quoteHash: quoteCheck.quoteHash,
            collector,
          })
        );
      }

      if (createdOrder.status === 'confirmed') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        }
        navigate({
          to: '/pedido/$orderId',
          params: { orderId: createdOrder.id },
        });
      }
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.code === 'QUOTE_OUTDATED') {
          await refetchCart();
          setQuoteOutdatedBanner(err.message);
        } else if (err.code === 'NETWORK_TIMEOUT') {
          setSubmissionError(
            `${err.message} Você pode clicar em "Retomar / Reenviar com mesma chave" sem risco de cobrança duplicada.`
          );
        } else {
          setSubmissionError(err.message);
        }
      } else {
        setSubmissionError(
          'Falha de conexão ao enviar o pedido. Tente novamente usando a mesma chave de idempotência.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledgeUpdatedQuote = async () => {
    const updated = await acknowledgeChanges();
    setConfirmedQuoteHash(updated.quoteHash);
    setQuoteOutdatedBanner(null);
    setSubmissionError(null);
    // Generate fresh idempotencyKey because the order payload (price/total) legitimately changed
    setIdempotencyKey(generateIdempotencyKey());
  };

  const handleRetryAfterDecline = () => {
    setActiveOrderId(null);
    setSubmissionError(null);
    setIdempotencyKey(generateIdempotencyKey());
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      {/* Breadcrumb (Desktop) & Back Header (Mobile) */}
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
          <span className="font-bold text-[#f5f1eb]">Pagamento</span>
        </nav>

        <div className="flex md:hidden items-center gap-4">
          <Link
            to="/carrinho"
            aria-label="Voltar para o carrinho"
            className="w-10 h-10 rounded-full bg-[#241612] border border-[#3f2319] flex items-center justify-center text-[#d28a4c]"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-[#f5f1eb]">
            Pagamento com carteira
          </h1>
        </div>
      </div>

      {/* Pending / Declined Order Status Banner */}
      {activeOrder && activeOrder.status === 'pending' && (
        <div
          role="status"
          aria-live="polite"
          data-testid="checkout-order-pending"
          className="mb-6 rounded-xl border border-[#d28a4c] bg-[#241612] p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <Loader2 className="w-6 h-6 text-[#d28a4c] animate-spin shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f1eb]">
                Processando transação na rede {activeOrder.network}...
              </h2>
              <p className="text-xs text-[#cfb28c] mt-0.5">
                Pedido <code className="text-[#d28a4c]">{activeOrder.id}</code> (Chave idempotente:{' '}
                <code>{activeOrder.idempotencyKey}</code>). Aguardando confirmação via Socket.IO.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="checkout-refresh-order-status"
            onClick={() => activeOrderQuery.refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sincronizar status</span>
          </Button>
        </div>
      )}

      {activeOrder && activeOrder.status === 'declined' && (
        <div
          role="alert"
          data-testid="checkout-order-declined"
          className="mb-6 rounded-xl border border-[#f0805f] bg-[#2f1512] p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <XCircle className="w-6 h-6 text-[#f0805f] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#f5f1eb]">
                Pedido recusado na simulação
              </h2>
              <p className="text-xs text-[#cfb28c] mt-0.5">
                {activeOrder.failureReason ||
                  'A transação foi recusada. Seus itens foram preservados integralmente no carrinho.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="checkout-retry-new-attempt"
            onClick={handleRetryAfterDecline}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Outdated Quote / Real-time Price Change Blocker */}
      {(quoteOutdatedBanner || hasRealtimeChanges) && (
        <div
          role="alert"
          data-testid="checkout-quote-outdated-banner"
          className="mb-6 rounded-xl border border-[#e89b55] bg-[#2f1d15] p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#e89b55] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-[#e89b55]">
                Cotação atualizada em tempo real — Confirmação necessária
              </p>
              <p className="text-[#f5f1eb]">
                {quoteOutdatedBanner ||
                  'O preço ou disponibilidade de um item do carrinho mudou. Revise o novo total antes de confirmar.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="checkout-confirm-updated-quote"
            onClick={handleAcknowledgeUpdatedQuote}
          >
            Confirmar novos valores ({cart?.totalEth} ETH)
          </Button>
        </div>
      )}

      {submissionError && (
        <div
          role="alert"
          data-testid="checkout-submission-error"
          className="mb-6 rounded-xl border border-[#f0805f] bg-[#2f1512] p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#f5f1eb]"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#f0805f] shrink-0" />
            <span>{submissionError}</span>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="checkout-retry-idempotent"
            disabled={submitting}
            onClick={() => handleConfirmPurchase()}
          >
            Retomar / Reenviar pedido
          </Button>
        </div>
      )}

      {/* Main Checkout Layout matching Figma Desktop / Pagamento & Mobile / Pagamento */}
      <form
        onSubmit={handleConfirmPurchase}
        noValidate
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
      >
        {/* Left Column: Perfil do colecionador & Registered Wallets */}
        <div className="lg:col-span-7 space-y-6">
          {/* Registered Wallets Selector (matches Mobile / Pagamento "Carteira conectada" + Desktop Registered Wallets requirement) */}
          {wallets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#f5f1eb]">
                  Carteira conectada
                </h2>
                <Link
                  to="/carteiras"
                  className="text-xs font-bold text-[#d28a4c] hover:underline"
                >
                  Trocar / Editar carteiras
                </Link>
              </div>

              <div
                role="radiogroup"
                aria-label="Selecionar carteira cadastrada"
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {wallets.map((w) => {
                  const selected = selectedWalletId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`checkout-wallet-card-${w.kind}`}
                      onClick={() => handleSelectRegisteredWallet(w.id)}
                      className={`text-left rounded-xl p-4 border transition-colors flex items-start gap-3 cursor-pointer ${
                        selected
                          ? 'bg-[#241612] border-[#d28a4c]'
                          : 'bg-[#241612]/50 border-[#3f2319] hover:border-[#b39463]'
                      }`}
                    >
                      <span
                        className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selected ? 'border-[#d28a4c]' : 'border-[#b39463]'
                        }`}
                      >
                        {selected && (
                          <span className="w-2 h-2 rounded-full bg-[#d28a4c]" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-bold text-[#f5f1eb]">
                          {w.nickname} ({w.kind === 'primary' ? 'Principal' : 'Secundária'})
                        </p>
                        <p className="text-xs text-[#cfb28c] truncate">
                          {w.address}
                        </p>
                        <p className="text-[11px] text-[#b39463]">
                          Rede {w.network} • {w.provider}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Wallet Connection Simulation Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3f2319] bg-[#241612]/60 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-[#cfb28c]">
                  <Wallet className="w-3.5 h-3.5 text-[#d28a4c]" />
                  Status da carteira:{' '}
                  <strong
                    data-testid="wallet-sim-status"
                    className={
                      walletConnectionStatus === 'connected'
                        ? 'text-[#59c36a]'
                        : 'text-[#f0805f]'
                    }
                  >
                    {walletConnectionStatus === 'connected'
                      ? 'Conectada'
                      : walletConnectionStatus === 'rejected'
                        ? 'Assinatura Recusada'
                        : 'Desconectada'}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="sim-wallet-connect"
                    onClick={() => simulateWalletConnectAction('connect')}
                    className="underline text-[#59c36a] cursor-pointer"
                  >
                    Simular Conexão
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    data-testid="sim-wallet-reject"
                    onClick={() => simulateWalletConnectAction('reject')}
                    className="underline text-[#e89b55] cursor-pointer"
                  >
                    Simular Recusa
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    data-testid="sim-wallet-disconnect"
                    onClick={() => simulateWalletConnectAction('disconnect')}
                    className="underline text-[#f0805f] cursor-pointer"
                  >
                    Simular Desconexão
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-base font-bold text-[#f5f1eb]">
              Perfil do colecionador
            </h2>

            {/* Row 1: Nome de exibição & Nome de usuário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-display-name"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome de exibição <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-display-name"
                  data-testid="checkout-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  error={fieldErrors.displayName}
                  aria-describedby={
                    fieldErrors.displayName ? 'err-checkout-display-name' : undefined
                  }
                />
                {fieldErrors.displayName && (
                  <p
                    id="err-checkout-display-name"
                    className="mt-1 text-xs text-[#f0805f]"
                  >
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-username"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome de usuário <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-username"
                  data-testid="checkout-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  error={fieldErrors.username}
                  aria-describedby={
                    fieldErrors.username ? 'err-checkout-username' : undefined
                  }
                />
                {fieldErrors.username && (
                  <p id="err-checkout-username" className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.username}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Rede & Nome do perfil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-network"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Rede <span className="text-[#f0805f]">*</span>
                </label>
                <select
                  id="checkout-network"
                  data-testid="checkout-network"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as NetworkType)}
                  className="h-11 w-full rounded-md border border-[#3f2319] bg-[#140d0a] px-3.5 text-sm text-[#f5f1eb] focus:border-[#d28a4c]"
                >
                  <option value="Ethereum">Ethereum</option>
                  <option value="Polygon">Polygon</option>
                  <option value="Solana">Solana</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="checkout-profile-name"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome do perfil <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-profile-name"
                  data-testid="checkout-profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  error={fieldErrors.profileName}
                />
                {fieldErrors.profileName && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.profileName}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Endereço da carteira & ENS secundária */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-wallet-address"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Endereço da carteira <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-wallet-address"
                  data-testid="checkout-wallet-address"
                  placeholder="Endereço 0x da carteira"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  error={fieldErrors.walletAddress}
                />
                {fieldErrors.walletAddress && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.walletAddress}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-secondary-ens"
                  className="block text-xs text-[#f5f1eb] mb-1.5 opacity-0 select-none"
                >
                  ENS secundário
                </label>
                <Input
                  id="checkout-secondary-ens"
                  placeholder="ENS ou carteira secundária (opcional)"
                  value={secondaryWalletOrEns}
                  onChange={(e) => setSecondaryWalletOrEns(e.target.value)}
                />
              </div>
            </div>

            {/* Row 4: Tipo de carteira & Código de indicação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-wallet-provider"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Tipo de carteira <span className="text-[#f0805f]">*</span>
                </label>
                <select
                  id="checkout-wallet-provider"
                  data-testid="checkout-wallet-provider"
                  value={walletProvider}
                  onChange={(e) =>
                    setWalletProvider(e.target.value as WalletProvider)
                  }
                  className="h-11 w-full rounded-md border border-[#3f2319] bg-[#140d0a] px-3.5 text-sm text-[#f5f1eb] focus:border-[#d28a4c]"
                >
                  <option value="MetaMask">MetaMask</option>
                  <option value="Coinbase Wallet">Coinbase Wallet</option>
                  <option value="WalletConnect">WalletConnect</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="checkout-referral-code"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Código de indicação <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-referral-code"
                  data-testid="checkout-referral-code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  error={fieldErrors.referralCode}
                />
                {fieldErrors.referralCode && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.referralCode}
                  </p>
                )}
              </div>
            </div>

            {/* Row 5: E-mail & Nome ENS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="checkout-email"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  E-mail <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="checkout-email"
                  data-testid="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-[#f0805f]">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-ens-name"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome ENS <span className="text-[#f0805f]">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    aria-label="Sufixo ENS"
                    value={ensDomain}
                    onChange={(e) => setEnsDomain(e.target.value as any)}
                    className="h-11 w-24 rounded-md border border-[#3f2319] bg-[#140d0a] px-2 text-xs text-[#f5f1eb]"
                  >
                    <option value=".eth">.eth</option>
                    <option value=".kurio.eth">.kurio.eth</option>
                    <option value=".xyz">.xyz</option>
                  </select>
                  <Input
                    id="checkout-ens-name"
                    data-testid="checkout-ens-name"
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    error={fieldErrors.ensName}
                    className="flex-1"
                  />
                </div>
                {fieldErrors.ensName && (
                  <p className="mt-1 text-xs text-[#f0805f]">{fieldErrors.ensName}</p>
                )}
              </div>
            </div>

            {/* Usar outra carteira? toggle */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2.5 text-xs text-[#f5f1eb] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAnotherWallet}
                  onChange={(e) => setUseAnotherWallet(e.target.checked)}
                  className="w-4 h-4 accent-[#d28a4c]"
                />
                <span>Usar outra carteira?</span>
              </label>
            </div>

            {/* Observação do colecionador */}
            <div>
              <label
                htmlFor="checkout-notes"
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Observação do colecionador (opcional)
              </label>
              <textarea
                id="checkout-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-[#3f2319] bg-[#140d0a] p-3 text-xs text-[#f5f1eb] focus:border-[#d28a4c]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Seus NFTs + Totals + Carteira e rede + Confirmar compra */}
        <aside
          aria-label="Resumo do pedido e confirmação"
          className="lg:col-span-5 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-[#f5f1eb] mb-3">Seus NFTs</h2>
            <div className="flex items-center justify-between text-xs font-bold text-[#f5f1eb] pb-2 border-b border-[#3f2319]">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>

            <div className="space-y-3 mt-3" data-testid="checkout-items-summary">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#241612] border border-[#3f2319] p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-md object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#f5f1eb] truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#b39463]">
                        ID do token: {item.tokenId} • {item.edition}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-[#cfb28c]">(x {item.quantity})</span>
                    <span className="font-bold text-[#e89b55]">
                      {item.lineTotalEth} ETH
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inline Promo Code trigger matching Figma */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowCouponBox((v) => !v)}
              className="text-xs text-[#cfb28c] hover:text-[#d28a4c] cursor-pointer"
            >
              Tem um código promocional?{' '}
              <span className="text-[#d28a4c] underline">Aplique aqui</span>
            </button>
            {showCouponBox && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Código do cupom..."
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value)}
                  className="flex-1 h-9 rounded border border-[#3f2319] bg-[#140d0a] px-3 text-xs text-[#f5f1eb]"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (couponCodeInput.trim()) {
                      await applyCoupon(couponCodeInput.trim());
                      setCouponCodeInput('');
                      setShowCouponBox(false);
                    }
                  }}
                >
                  Aplicar
                </Button>
              </div>
            )}
          </div>

          {/* Breakdown matching Figma */}
          <dl className="space-y-2.5 text-xs sm:text-sm border-b border-[#3f2319] pb-4">
            <div className="flex justify-between">
              <dt className="text-[#f5f1eb]">Subtotal</dt>
              <dd data-testid="checkout-subtotal" className="text-[#f5f1eb]">
                {cart?.subtotalEth || '0.00'} ETH
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#f5f1eb]">Desconto do lançamento</dt>
              <dd data-testid="checkout-discount" className="text-[#f5f1eb]">
                (-) {cart?.discountEth || '0.00'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#f5f1eb]">Taxa de rede</dt>
              <dd data-testid="checkout-network-fee" className="text-[#f5f1eb]">
                {cart?.networkFeeEth || '0.016'} ETH
              </dd>
            </div>
            <div className="text-center pt-1">
              <span className="text-[11px] text-[#d28a4c]">Taxa estimada</span>
            </div>
          </dl>

          <div className="flex items-center justify-between text-base font-bold px-2">
            <span className="text-[#f5f1eb]">Total</span>
            <span data-testid="checkout-total" className="text-[#e89b55]">
              {cart?.totalEth || '0.00'} ETH
            </span>
          </div>

          {/* Carteira e rede radio group matching Figma */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#f5f1eb] text-center">
              Carteira e rede
            </h3>

            <div
              role="radiogroup"
              aria-label="Provedor de carteira para pagamento"
              className="space-y-2.5"
            >
              {(
                [
                  {
                    id: 'WalletConnect',
                    label: 'METAMASK • WALLETCONNECT • COINBASE',
                    isBadge: true,
                  },
                  { id: 'MetaMask', label: 'MetaMask', isBadge: false },
                  {
                    id: 'Coinbase Wallet',
                    label: 'Coinbase Wallet',
                    isBadge: false,
                  },
                ] as const
              ).map((opt) => {
                const checked = walletProvider === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    data-testid={`provider-radio-${opt.id}`}
                    onClick={() => setWalletProvider(opt.id)}
                    className={`w-full h-11 rounded-md border px-4 flex items-center gap-3 text-xs transition-colors cursor-pointer ${
                      checked
                        ? 'border-[#d28a4c] bg-[#241612] text-[#f5f1eb]'
                        : 'border-[#3f2319] bg-[#140d0a] text-[#cfb28c]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        checked ? 'border-[#d28a4c]' : 'border-[#b39463]'
                      }`}
                    >
                      {checked && (
                        <span className="w-2 h-2 rounded-full bg-[#d28a4c]" />
                      )}
                    </span>
                    {opt.isBadge ? (
                      <span className="px-2 py-0.5 rounded bg-[#241612] border border-[#3f2319] text-[10px] font-bold text-[#d28a4c]">
                        {opt.label}
                      </span>
                    ) : (
                      <span className="font-medium">{opt.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Snapshot Collapsible before submit */}
          <div className="rounded-lg border border-[#3f2319] bg-[#241612]/60 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#f5f1eb]">
                Revisão da compra ({network})
              </span>
              <button
                type="button"
                onClick={() => setReviewStepOpen((v) => !v)}
                className="text-[#d28a4c] underline cursor-pointer"
              >
                {reviewStepOpen ? 'Ocultar revisão' : 'Revisar dados'}
              </button>
            </div>
            {reviewStepOpen && (
              <div
                data-testid="checkout-review-summary"
                className="pt-2 border-t border-[#3f2319] space-y-1 text-[11px] text-[#cfb28c]"
              >
                <p>Colecionador: {displayName} (@{username})</p>
                <p>Carteira: {walletAddress} ({walletProvider})</p>
                <p>Rede: {network} • Total: {cart?.totalEth} ETH</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            data-testid="checkout-submit-button"
            disabled={
              submitting ||
              activeOrder?.status === 'pending' ||
              items.length === 0
            }
            className="w-full h-12 text-sm font-bold"
          >
            {submitting || activeOrder?.status === 'pending' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirmando na rede...</span>
              </>
            ) : (
              <span>Confirmar compra</span>
            )}
          </Button>
        </aside>
      </form>
    </div>
  );
}
