import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { socketManager } from '@/lib/socket';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'info' | 'warning' | 'success' | 'danger';
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = toast.id || `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        return [...prev.slice(-4), { ...toast, id }];
      });
      setTimeout(() => {
        dismissToast(id);
      }, 6000);
    },
    [dismissToast]
  );

  useEffect(() => {
    return socketManager.subscribeNotices((notice) => {
      addToast({
        id: `rt_${notice.id}`,
        title: notice.title,
        description: notice.description,
        variant: notice.variant || 'info',
      });
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
      <div
        role="region"
        aria-label="Notificações do sistema"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 z-[60] flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast-notification"
            role={t.variant === 'danger' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-xl transition-all ${
              t.variant === 'danger'
                ? 'bg-[#2f1512] border-[#f0805f] text-[#f5f1eb]'
                : t.variant === 'warning'
                  ? 'bg-[#2f1d15] border-[#e89b55] text-[#f5f1eb]'
                  : t.variant === 'success'
                    ? 'bg-[#15281a] border-[#59c36a] text-[#f5f1eb]'
                    : 'bg-[#241612] border-[#d28a4c] text-[#f5f1eb]'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.variant === 'danger' ? (
                <AlertCircle className="w-5 h-5 text-[#f0805f]" />
              ) : t.variant === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-[#e89b55]" />
              ) : t.variant === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#59c36a]" />
              ) : (
                <Info className="w-5 h-5 text-[#d28a4c]" />
              )}
            </div>
            <div className="flex-1 text-xs leading-relaxed">
              <p className="font-bold text-sm mb-0.5">{t.title}</p>
              {t.description && <p className="text-[#cfb28c]">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar notificação"
              className="text-[#cfb28c] hover:text-[#f5f1eb] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
