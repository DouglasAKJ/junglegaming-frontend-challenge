import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2, X, Zap, RotateCcw, WifiOff, Clock, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { socketManager } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';

export function SimulationDevtoolsPanel() {
  const [open, setOpen] = useState(false);
  const [latencyMs, setLatencyMs] = useState(120);
  const [orderOutcome, setOrderOutcome] = useState<
    'confirm' | 'decline' | 'timeout_then_pending'
  >('confirm');
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  useEffect(() => {
    if (open) {
      api.sim
        .getState()
        .then((res) => {
          setLatencyMs(res.sim.latencyMs);
          setOrderOutcome(res.sim.orderOutcome);
        })
        .catch(() => {});
    }
  }, [open]);

  const handleResetAll = async (seedCart = false) => {
    await api.sim.reset(seedCart);
    queryClient.invalidateQueries();
    addToast({
      title: seedCart
        ? 'Cenário resetado (com carrinho do Figma)'
        : 'Cenário padrão restaurado',
      description: 'Banco de dados simulado e configurações de rede restaurados.',
      variant: 'success',
    });
  };

  const handleEmitPriceChange = async () => {
    await api.sim.emitNftUpdated({
      nftId: 'emerald-ape-042',
      edition: '1/50',
      priceEth: '1.49',
      available: 12,
    });
  };

  const handleEmitStockOut = async () => {
    await api.sim.emitNftUpdated({
      nftId: 'emerald-ape-042',
      edition: '1/50',
      available: 0,
    });
  };

  const handleSimulateSessionExpire = async () => {
    await api.sim.updateConfig({ forceSessionExpired: true });
    addToast({
      title: 'Expiração de sessão ativada',
      description: 'A próxima requisição privada retornará 401 SESSION_EXPIRED.',
      variant: 'warning',
    });
  };

  const handleSimulateDisconnect = async () => {
    await api.sim.disconnectSockets();
    setTimeout(() => {
      socketManager.reconnect();
    }, 800);
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid="sim-devtools-trigger"
        onClick={() => setOpen(true)}
        aria-label="Simulador MSW/WS — Abrir painel de controle"
        className="fixed bottom-20 md:bottom-4 left-4 z-50 h-9 px-3 rounded-full bg-[#241612]/90 border border-[#d28a4c]/60 text-[11px] font-bold text-[#d28a4c] shadow-lg flex items-center gap-1.5 hover:bg-[#2f1d15] cursor-pointer"
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span>Simulador MSW/WS</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Painel de simulação de rede e eventos"
      data-testid="sim-devtools-panel"
      className="fixed bottom-20 md:bottom-4 left-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-[#241612] border-2 border-[#d28a4c] p-4 shadow-2xl text-xs space-y-3"
    >
      <div className="flex items-center justify-between border-b border-[#3f2319] pb-2">
        <span className="font-bold text-[#d28a4c] flex items-center gap-1.5">
          <Zap className="w-4 h-4" />
          <span>Controle de Cenários MSW + Socket.IO</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar painel de simulação"
          className="text-[#cfb28c] hover:text-[#f5f1eb] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] text-[#cfb28c]">
          Latência REST ({latencyMs}ms):
        </label>
        <div className="flex gap-1.5">
          {[50, 350, 1200].map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={async () => {
                setLatencyMs(ms);
                await api.sim.updateConfig({ latencyMs: ms });
              }}
              className={`flex-1 py-1 rounded border text-[11px] cursor-pointer ${
                latencyMs === ms
                  ? 'border-[#d28a4c] bg-[#d28a4c] text-[#140d0a] font-bold'
                  : 'border-[#3f2319] bg-[#140d0a] text-[#cfb28c]'
              }`}
            >
              {ms === 50 ? 'Rápida' : ms === 350 ? 'Média' : 'Lenta (1.2s)'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] text-[#cfb28c]">
          Resultado do próximo Pedido:
        </label>
        <select
          value={orderOutcome}
          onChange={async (e) => {
            const val = e.target.value as any;
            setOrderOutcome(val);
            await api.sim.updateConfig({ orderOutcome: val });
          }}
          className="w-full h-8 rounded border border-[#3f2319] bg-[#140d0a] px-2 text-[11px] text-[#f5f1eb]"
        >
          <option value="confirm">Confirmar compra (Socket.IO)</option>
          <option value="decline">Recusar pagamento (Socket.IO)</option>
          <option value="timeout_then_pending">
            Timeout HTTP 504 + Recuperar Idempotente
          </option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleEmitPriceChange}
          className="p-2 rounded border border-[#55321f] bg-[#140d0a] hover:border-[#d28a4c] text-[11px] text-left flex items-center gap-1.5 cursor-pointer"
        >
          <DollarSign className="w-3.5 h-3.5 text-[#e89b55] shrink-0" />
          <span>Mudar preço Emerald Ape</span>
        </button>

        <button
          type="button"
          onClick={handleEmitStockOut}
          className="p-2 rounded border border-[#55321f] bg-[#140d0a] hover:border-[#f0805f] text-[11px] text-left flex items-center gap-1.5 cursor-pointer"
        >
          <Clock className="w-3.5 h-3.5 text-[#f0805f] shrink-0" />
          <span>Esgotar Emerald Ape</span>
        </button>

        <button
          type="button"
          onClick={() => api.sim.updateConfig({ failNextRequest: true })}
          className="p-2 rounded border border-[#55321f] bg-[#140d0a] hover:border-[#f0805f] text-[11px] text-left cursor-pointer"
        >
          Falhar próxima req (503)
        </button>

        <button
          type="button"
          onClick={handleSimulateSessionExpire}
          className="p-2 rounded border border-[#55321f] bg-[#140d0a] hover:border-[#e89b55] text-[11px] text-left cursor-pointer"
        >
          Expirar sessão (401)
        </button>

        <button
          type="button"
          onClick={handleSimulateDisconnect}
          className="col-span-2 p-2 rounded border border-[#55321f] bg-[#140d0a] hover:border-[#d28a4c] text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <WifiOff className="w-3.5 h-3.5 text-[#d28a4c]" />
          <span>Desconectar & Reconectar Socket.IO</span>
        </button>
      </div>

      <div className="flex gap-2 pt-2 border-t border-[#3f2319]">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleResetAll(false)}
          className="flex-1 text-[11px] h-8"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Limpo</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => handleResetAll(true)}
          className="flex-1 text-[11px] h-8"
        >
          <span>Seed Carrinho Figma</span>
        </Button>
      </div>
    </aside>
  );
}
