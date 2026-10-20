import React, { useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle, ExternalLink, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { socketManager } from '@/lib/socket';
import { useAuth } from '@/features/auth/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const userId = user?.id || null;

  const orderQuery = useQuery({
    queryKey: queryKeys.orders.detail(userId, orderId),
    queryFn: ({ signal }) => api.orders.getById(orderId, signal),
    enabled: Boolean(isAuthenticated && userId && orderId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status === 'pending') {
        return 1000;
      }
      return false;
    },
  });

  const order = orderQuery.data;

  useEffect(() => {
    if (order) {
      socketManager.seedOrderVersion(order.id, order.version);
    }
  }, [order]);

  if (orderQuery.isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div
        role="alert"
        data-testid="order-receipt-error"
        className="max-w-lg mx-auto px-4 py-16 text-center space-y-4"
      >
        <AlertTriangle className="w-12 h-12 text-[#f0805f] mx-auto" />
        <h1 className="text-xl font-bold text-[#f5f1eb]">
          Recibo do pedido não encontrado
        </h1>
        <p className="text-xs text-[#cfb28c]">
          {orderQuery.error instanceof Error
            ? orderQuery.error.message
            : 'Não foi possível localizar este pedido para a conta atual.'}
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-[#d28a4c] px-5 py-2.5 text-xs font-bold text-[#140d0a]"
        >
          Voltar ao Início
        </Link>
      </div>
    );
  }

  // Requirement: "Exibir a confirmação somente para pedido efetivamente confirmado na simulação."
  if (order.status === 'pending') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="order-receipt-pending"
        className="max-w-lg mx-auto px-4 py-16 text-center space-y-4"
      >
        <Loader2 className="w-12 h-12 text-[#d28a4c] animate-spin mx-auto" />
        <h1 className="text-xl font-bold text-[#f5f1eb]">
          Aguardando confirmação da transação na rede...
        </h1>
        <p className="text-xs text-[#cfb28c]">
          O pedido <code>{order.id}</code> ainda está pendente. O recibo será exibido assim que o evento{' '}
          <code>order.updated</code> confirmar a transação.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => orderQuery.refetch()}
        >
          Atualizar status
        </Button>
      </div>
    );
  }

  if (order.status === 'declined') {
    return (
      <div
        role="alert"
        data-testid="order-receipt-declined"
        className="max-w-lg mx-auto px-4 py-16 text-center space-y-4"
      >
        <AlertTriangle className="w-12 h-12 text-[#f0805f] mx-auto" />
        <h1 className="text-xl font-bold text-[#f5f1eb]">
          Pedido recusado ({order.id})
        </h1>
        <p className="text-xs text-[#cfb28c]">
          {order.failureReason ||
            'Este pedido foi recusado na simulação e não gerou recibo de confirmação. Seus itens continuam no carrinho.'}
        </p>
        <Link
          to="/pagamento"
          className="inline-flex items-center justify-center rounded-md bg-[#d28a4c] px-5 py-2.5 text-xs font-bold text-[#140d0a]"
        >
          Voltar para o pagamento
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="max-w-xl mx-auto px-4 py-8 md:py-14">
      <section
        aria-label="Recibo de confirmação de pedido"
        data-testid="order-confirmation-receipt"
        className="relative rounded-lg bg-[#241612] border border-[#3f2319] border-b-4 border-b-[#d28a4c] p-5 sm:p-8 shadow-2xl"
      >
        <Link
          to="/"
          aria-label="Fechar recibo e voltar ao início"
          className="absolute right-4 top-4 text-[#d28a4c] hover:text-[#f5f1eb] p-1"
        >
          <X className="w-5 h-5" />
        </Link>

        {/* Thank You Envelope Header matching Figma */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-xl border-2 border-[#d28a4c] bg-[#140d0a] flex flex-col items-center justify-center text-[#d28a4c] mb-3">
            <span className="text-[9px] font-bold leading-tight uppercase">
              THANK
              <br />
              YOU
            </span>
            <MailCheck className="w-5 h-5 mt-0.5" />
          </div>
          <h1 className="text-sm sm:text-base font-bold text-[#f5f1eb]">
            Seus NFTs agora estão na sua carteira
          </h1>
        </div>

        {/* 4-column Metadata Bar matching Figma */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 px-2 border-y border-[#55321f] text-xs mb-6">
          <div className="sm:border-r sm:border-[#55321f] sm:pr-2">
            <p className="text-[#cfb28c] font-bold">ID da transação</p>
            <p
              data-testid="receipt-tx-hash"
              className="text-[#f5f1eb] mt-0.5 truncate"
            >
              {order.txHash}
            </p>
          </div>
          <div className="sm:border-r sm:border-[#55321f] sm:px-2">
            <p className="text-[#cfb28c]">Data</p>
            <p className="text-[#f5f1eb] mt-0.5">{formattedDate}</p>
          </div>
          <div className="sm:border-r sm:border-[#55321f] sm:px-2">
            <p className="text-[#cfb28c]">Total</p>
            <p
              data-testid="receipt-header-total"
              className="text-[#f5f1eb] mt-0.5"
            >
              {order.totalEth} ETH
            </p>
          </div>
          <div className="sm:pl-2">
            <p className="text-[#cfb28c] font-bold">Carteira</p>
            <p
              data-testid="receipt-wallet-provider"
              className="text-[#f5f1eb] mt-0.5 truncate"
            >
              {order.walletProvider}
            </p>
          </div>
        </div>

        {/* Detalhes da transação */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-[#f5f1eb]">
            Detalhes da transação
          </h2>

          <div className="grid grid-cols-12 text-xs font-bold text-[#f5f1eb] pb-2 border-b border-[#3f2319]">
            <div className="col-span-7">NFTs</div>
            <div className="col-span-2 text-center">Edições</div>
            <div className="col-span-3 text-right">Subtotal</div>
          </div>

          <div className="space-y-3 pt-1" data-testid="receipt-items-list">
            {order.items.map((item) => (
              <div
                key={`${item.nftId}:${item.edition}`}
                data-testid={`receipt-item-${item.nftId}`}
                className="grid grid-cols-12 items-center gap-2 text-xs py-1.5"
              >
                <div className="col-span-7 flex items-center gap-3 min-w-0">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-11 h-11 rounded-md object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-[#f5f1eb] truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#b39463]">
                      ID do token: {item.tokenId}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 text-center text-[#cfb28c]">
                  (x {item.quantity})
                </div>

                <div
                  data-testid={`receipt-item-subtotal-${item.nftId}`}
                  className="col-span-3 text-right font-bold text-[#e89b55]"
                >
                  {item.subtotalEth} ETH
                </div>
              </div>
            ))}
          </div>

          {/* Totals Snapshot */}
          <div className="pt-4 border-t border-[#3f2319] space-y-2 text-xs sm:text-sm">
            {Number(order.discountEth) > 0 && (
              <div className="flex justify-between text-[#cfb28c]">
                <span>Desconto aplicado</span>
                <span>(-) {order.discountEth} ETH</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#f5f1eb] sm:ml-auto sm:mr-12">
                Taxa de rede
              </span>
              <span
                data-testid="receipt-network-fee"
                className="text-[#f5f1eb] font-medium"
              >
                {order.networkFeeEth} ETH
              </span>
            </div>
            <div className="flex justify-between font-bold text-sm sm:text-base pt-1">
              <span className="text-[#f5f1eb] sm:ml-auto sm:mr-12">Total</span>
              <span data-testid="receipt-total" className="text-[#e89b55]">
                {order.totalEth} ETH
              </span>
            </div>
          </div>
        </div>

        {/* Footer confirmation message + Ver no Etherscan CTA */}
        <div className="mt-6 pt-5 border-t border-[#3f2319] text-center space-y-5">
          <p className="text-xs text-[#cfb28c] leading-relaxed max-w-md mx-auto">
            Transação confirmada na {order.network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
          </p>

          <Button
            type="button"
            data-testid="receipt-explorer-button"
            onClick={() =>
              addToast({
                title: 'Explorador de blocos simulado',
                description: `Referência da transação: ${order.txHash} na rede ${order.network}.`,
                variant: 'info',
              })
            }
            className="px-6"
          >
            <span>Ver no Etherscan</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </section>
    </div>
  );
}
