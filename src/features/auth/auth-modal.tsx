import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from './auth-context';
import { AppApiError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';

interface AuthFormCardProps {
  initialMode?: 'login' | 'register';
  redirectTo?: string | null;
  reason?: string | null;
  isPage?: boolean;
  onSuccess?: () => void;
}

export function AuthFormCard({
  initialMode = 'login',
  redirectTo,
  reason,
  isPage = false,
  onSuccess,
}: AuthFormCardProps) {
  const { login, register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    setMode(initialMode);
    setGeneralError(null);
    setFieldErrors({});
  }, [initialMode]);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setGeneralError(null);
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const nextFieldErrors: Record<string, string> = {};
    if (mode === 'register') {
      if (username.trim().length < 3) {
        nextFieldErrors.username = 'O nome de usuário deve ter pelo menos 3 caracteres';
      }
      if (!email.trim().includes('@')) {
        nextFieldErrors.email = 'Digite um e-mail válido';
      }
      if (password.length < 6) {
        nextFieldErrors.password = 'A senha deve ter pelo menos 6 caracteres';
      }
      if (confirmPassword !== password) {
        nextFieldErrors.confirmPassword = 'As senhas não coincidem';
      }
    } else {
      if (!email.trim().includes('@')) {
        nextFieldErrors.email = 'Digite um e-mail válido';
      }
      if (!password) {
        nextFieldErrors.password = 'Informe sua senha';
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        });
      }

      if (onSuccess) {
        onSuccess();
      }
      if (redirectTo) {
        navigate({ to: redirectTo as any });
      } else if (isPage) {
        navigate({ to: '/' });
      }
    } catch (err) {
      if (err instanceof AppApiError) {
        setGeneralError(err.message);
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setGeneralError('Não foi possível autenticar agora. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOutOfScopeAction = (featureName: string) => {
    addToast({
      title: `${featureName} fora do escopo da simulação`,
      description:
        'Utilize o login com e-mail e senha fictícios (ex: contato@email.com / kurio123).',
      variant: 'info',
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {isPage && (
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-widest text-[#f5f1eb]">KURIO</span>
        </div>
      )}

      {/* Header Toggle matching Figma */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          type="button"
          data-testid="auth-tab-login"
          onClick={() => switchMode('login')}
          className={`text-lg font-bold transition-colors cursor-pointer ${
            mode === 'login' ? 'text-[#d28a4c]' : 'text-[#f5f1eb] hover:text-[#cfb28c]'
          }`}
        >
          Entrar
        </button>
        <span className="text-[#55321f] font-light">|</span>
        <button
          type="button"
          data-testid="auth-tab-register"
          onClick={() => switchMode('register')}
          className={`text-lg font-bold transition-colors cursor-pointer ${
            mode === 'register' ? 'text-[#d28a4c]' : 'text-[#f5f1eb] hover:text-[#cfb28c]'
          }`}
        >
          Criar conta
        </button>
      </div>

      <p className="text-center text-xs text-[#cfb28c] mb-5 max-w-xs mx-auto leading-relaxed">
        {mode === 'login'
          ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
          : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
      </p>

      {reason && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-[#e89b55] bg-[#2f1d15] p-3 text-xs text-[#f5f1eb]"
        >
          <AlertCircle className="w-4 h-4 text-[#e89b55] shrink-0 mt-0.5" />
          <span>{reason}</span>
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          data-testid="auth-error-banner"
          className="mb-4 flex items-start gap-2 rounded-md border border-[#f0805f] bg-[#2f1512] p-3 text-xs text-[#f5f1eb]"
        >
          <AlertCircle className="w-4 h-4 text-[#f0805f] shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {mode === 'register' && (
          <div>
            <label htmlFor="auth-username" className="sr-only">
              Nome de usuário
            </label>
            <Input
              id="auth-username"
              data-testid="auth-username-input"
              type="text"
              placeholder="Nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
              autoComplete="username"
            />
            {fieldErrors.username && (
              <p id="auth-username-error" className="mt-1 text-xs text-[#f0805f]">
                {fieldErrors.username}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="auth-email" className="sr-only">
            E-mail
          </label>
          <Input
            id="auth-email"
            data-testid="auth-email-input"
            type="email"
            placeholder={mode === 'login' ? 'contato@email.com' : 'Digite seu e-mail'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
            autoComplete="email"
          />
          {fieldErrors.email && (
            <p id="auth-email-error" className="mt-1 text-xs text-[#f0805f]">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="auth-password" className="sr-only">
            Senha
          </label>
          <div className="relative">
            <Input
              id="auth-password"
              data-testid="auth-password-input"
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'login' ? '************' : 'Senha'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b39463] hover:text-[#f5f1eb] cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="auth-password-error" className="mt-1 text-xs text-[#f0805f]">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="auth-confirm-password" className="sr-only">
              Confirmar senha
            </label>
            <div className="relative">
              <Input
                id="auth-confirm-password"
                data-testid="auth-confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirmPassword}
                aria-describedby={
                  fieldErrors.confirmPassword ? 'auth-confirm-password-error' : undefined
                }
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b39463] hover:text-[#f5f1eb] cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p id="auth-confirm-password-error" className="mt-1 text-xs text-[#f0805f]">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        )}

        {mode === 'login' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleOutOfScopeAction('Recuperação de senha por e-mail')}
              className="text-xs text-[#d28a4c] hover:underline cursor-pointer"
            >
              Esqueceu a senha?
            </button>
          </div>
        )}

        <Button
          type="submit"
          data-testid="auth-submit-button"
          disabled={submitting}
          className="w-full mt-2"
        >
          {submitting
            ? 'Processando...'
            : mode === 'login'
              ? 'Entrar'
              : 'Criar conta'}
        </Button>
      </form>

      {/* Quick Demo Credentials helper */}
      <div className="mt-4 rounded-md border border-[#3f2319] bg-[#140d0a]/60 p-2.5 text-[11px] text-[#cfb28c] flex flex-wrap items-center justify-between gap-2">
        <span>Contas demo:</span>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="fill-demo-user-1"
            onClick={() => {
              setMode('login');
              setEmail('contato@email.com');
              setPassword('kurio123');
            }}
            className="underline text-[#d28a4c] hover:text-[#e89b55] cursor-pointer"
          >
            Nova Sato
          </button>
          <span>•</span>
          <button
            type="button"
            data-testid="fill-demo-user-2"
            onClick={() => {
              setMode('login');
              setEmail('kai@kurio.art');
              setPassword('kurio123');
            }}
            className="underline text-[#d28a4c] hover:text-[#e89b55] cursor-pointer"
          >
            Kai Collector
          </button>
        </div>
      </div>

      {/* Social buttons (out of scope per INSTRUCTIONS.md — coherent feedback without fake success) */}
      <div className="relative my-5 flex items-center justify-center">
        <div className="border-t border-[#3f2319] w-full" />
        <span className="bg-[#241612] px-3 text-xs text-[#cfb28c] whitespace-nowrap">
          Ou continue com
        </span>
        <div className="border-t border-[#3f2319] w-full" />
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => handleOutOfScopeAction('OAuth Social (Google)')}
          className="w-full h-10 rounded-md border border-[#3f2319] bg-[#140d0a]/80 hover:bg-[#2f1d15] text-xs text-[#cfb28c] flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <span className="font-bold text-[#4086f4]">G</span>
          <span>Continuar com Google</span>
        </button>
        <button
          type="button"
          onClick={() => handleOutOfScopeAction('OAuth Social (Facebook)')}
          className="w-full h-10 rounded-md border border-[#3f2319] bg-[#140d0a]/80 hover:bg-[#2f1d15] text-xs text-[#cfb28c] flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
        >
          <span className="font-bold text-[#4175df]">f</span>
          <span>Continuar com Facebook</span>
        </button>
      </div>

      <div className="mt-5 text-center text-xs text-[#cfb28c]">
        {mode === 'login' ? (
          <button
            type="button"
            onClick={() => switchMode('register')}
            className="hover:text-[#d28a4c] cursor-pointer"
          >
            Novo na Kurio? <span className="text-[#d28a4c] underline">Crie uma conta</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="hover:text-[#d28a4c] cursor-pointer"
          >
            Já tem uma conta? <span className="text-[#d28a4c] underline">Entre</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function GlobalAuthDialog() {
  const { authModal, closeAuthModal } = useAuth();

  return (
    <Dialog
      open={authModal.isOpen}
      onOpenChange={(open) => {
        if (!open) closeAuthModal();
      }}
    >
      <DialogContent data-testid="auth-dialog">
        <DialogTitle className="sr-only">
          {authModal.mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Formulário de autenticação de colecionador da Kurio
        </DialogDescription>
        <AuthFormCard
          initialMode={authModal.mode}
          redirectTo={authModal.redirectTo}
          reason={authModal.reason}
          onSuccess={() => {
            const cb = authModal.onSuccessCallback;
            closeAuthModal();
            if (cb) cb();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
