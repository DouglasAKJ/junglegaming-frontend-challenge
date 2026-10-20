import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import {
  NetworkType,
  WalletProvider,
  WalletItem,
  UpsertWalletInput,
} from '@/types/contracts';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/features/auth/auth-context';
import { AccountSidebar } from './account-sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';

interface WalletFormSectionProps {
  kind: 'primary' | 'secondary';
  initialWallet?: WalletItem;
  primaryWallet?: WalletItem;
  userId: string | null;
}

function WalletFormSection({
  kind,
  initialWallet,
  primaryWallet,
  userId,
}: WalletFormSectionProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [isExpanded, setIsExpanded] = useState(
    kind === 'primary' || Boolean(initialWallet)
  );
  const [sameAsPrimary, setSameAsPrimary] = useState(false);

  const [displayName, setDisplayName] = useState(
    initialWallet?.displayName || user?.displayName || ''
  );
  const [nickname, setNickname] = useState(
    initialWallet?.nickname || (kind === 'primary' ? 'Principal' : 'Reserva')
  );
  const [network, setNetwork] = useState<NetworkType>(
    initialWallet?.network || (kind === 'primary' ? 'Ethereum' : 'Polygon')
  );
  const [profileName, setProfileName] = useState(
    initialWallet?.profileName || user?.displayName || ''
  );
  const [address, setAddress] = useState(
    initialWallet?.address || '0xA91F234567890ABCDE1234567890ABCDEF12E82C'
  );
  const [secondaryEnsOrAddress, setSecondaryEnsOrAddress] = useState(
    initialWallet?.secondaryEnsOrAddress || ''
  );
  const [provider, setProvider] = useState<WalletProvider>(
    initialWallet?.provider || 'MetaMask'
  );
  const [referralCode, setReferralCode] = useState(
    initialWallet?.referralCode || 'KURIO2026'
  );
  const [email, setEmail] = useState(initialWallet?.email || user?.email || '');
  const [ensName, setEnsName] = useState(
    initialWallet?.ensName || user?.ensName || 'nova.kurio'
  );
  const [ensDomain, setEnsDomain] = useState<'.eth' | '.kurio.eth' | '.xyz'>(
    initialWallet?.ensDomain || '.eth'
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (initialWallet) {
      setDisplayName(initialWallet.displayName);
      setNickname(initialWallet.nickname);
      setNetwork(initialWallet.network);
      setProfileName(initialWallet.profileName);
      setAddress(initialWallet.address);
      setSecondaryEnsOrAddress(initialWallet.secondaryEnsOrAddress || '');
      setProvider(initialWallet.provider);
      setReferralCode(initialWallet.referralCode);
      setEmail(initialWallet.email);
      setEnsName(initialWallet.ensName);
      setEnsDomain(initialWallet.ensDomain || '.eth');
      setIsExpanded(true);
    }
  }, [initialWallet?.id]);

  const handleCopyFromPrimary = (checked: boolean) => {
    setSameAsPrimary(checked);
    if (checked && primaryWallet) {
      setIsExpanded(true);
      setDisplayName(primaryWallet.displayName);
      setNickname('Reserva');
      setNetwork(primaryWallet.network);
      setProfileName(primaryWallet.profileName);
      setAddress(primaryWallet.address);
      setSecondaryEnsOrAddress(primaryWallet.secondaryEnsOrAddress || '');
      setProvider(primaryWallet.provider);
      setReferralCode(primaryWallet.referralCode);
      setEmail(primaryWallet.email);
      setEnsName(primaryWallet.ensName);
      setEnsDomain(primaryWallet.ensDomain);
    }
  };

  const upsertMutation = useMutation({
    mutationFn: (input: UpsertWalletInput) => api.wallets.upsert(kind, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.wallets(userId), {
        wallets: data.wallets,
      });
      addToast({
        title:
          kind === 'primary'
            ? 'Carteira principal salva!'
            : 'Carteira secundária salva!',
        description: `Endereço ${data.wallet.address} atualizado na rede ${data.wallet.network}.`,
        variant: 'success',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      errs.displayName = 'Nome de exibição obrigatório';
    }
    if (nickname.trim().length < 2) {
      errs.nickname = 'Apelido da carteira obrigatório';
    }
    if (profileName.trim().length < 2) {
      errs.profileName = 'Nome do perfil obrigatório';
    }
    if (
      !/^0x[a-fA-F0-9]{4,40}$|^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/.test(
        address.trim()
      )
    ) {
      errs.address = 'Endereço 0x inválido';
    }
    if (referralCode.trim().length < 2) {
      errs.referralCode = 'Código de indicação obrigatório';
    }
    if (!email.trim().includes('@')) {
      errs.email = 'E-mail inválido';
    }
    if (ensName.trim().length < 2) {
      errs.ensName = 'Nome ENS obrigatório';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      await upsertMutation.mutateAsync({
        kind,
        displayName: displayName.trim(),
        nickname: nickname.trim(),
        network,
        profileName: profileName.trim(),
        address: address.trim(),
        secondaryEnsOrAddress: secondaryEnsOrAddress.trim(),
        provider,
        referralCode: referralCode.trim(),
        email: email.trim(),
        ensName: ensName.trim(),
        ensDomain,
        isConnected: true,
      });
    } catch (err) {
      if (err instanceof AppApiError) {
        setGeneralError(err.message);
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        }
      } else {
        setGeneralError('Não foi possível salvar a carteira.');
      }
    }
  };

  return (
    <section
      data-testid={`wallet-section-${kind}`}
      aria-label={kind === 'primary' ? 'Carteira principal' : 'Carteira secundária'}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#f5f1eb]">
            {kind === 'primary' ? 'Carteira principal' : 'Carteira secundária'}
          </h2>
          <p className="text-xs text-[#cfb28c] mt-0.5">
            {kind === 'primary'
              ? 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.'
              : initialWallet
                ? `Configurada: ${initialWallet.nickname} (${initialWallet.network})`
                : 'Você ainda não adicionou uma carteira secundária.'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {kind === 'secondary' && (
            <label className="inline-flex items-center gap-2 text-xs text-[#f5f1eb] cursor-pointer">
              <input
                type="checkbox"
                data-testid="secondary-same-as-primary"
                checked={sameAsPrimary}
                onChange={(e) => handleCopyFromPrimary(e.target.checked)}
                className="w-4 h-4 accent-[#d28a4c]"
              />
              <span>Igual à carteira principal</span>
            </label>
          )}
          <button
            type="button"
            data-testid={`wallet-toggle-${kind}`}
            onClick={() => setIsExpanded((v) => !v)}
            className="text-xs font-bold text-[#d28a4c] hover:underline cursor-pointer"
          >
            {isExpanded ? 'Adicionar / Editar' : 'Adicionar'}
          </button>
        </div>
      </div>

      {generalError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-[#f0805f] bg-[#2f1512] p-3 text-xs text-[#f5f1eb]"
        >
          <AlertCircle className="w-4 h-4 text-[#f0805f]" />
          <span>{generalError}</span>
        </div>
      )}

      {isExpanded && (
        <form onSubmit={handleSubmit} noValidate className="space-y-5 pt-2">
          {/* Row 1: Nome de exibição & Apelido da carteira */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor={`wallet-${kind}-display-name`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Nome de exibição <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-display-name`}
                data-testid={`wallet-${kind}-display-name`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={fieldErrors.displayName}
              />
              {fieldErrors.displayName && (
                <p className="mt-1 text-xs text-[#f0805f]">
                  {fieldErrors.displayName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`wallet-${kind}-nickname`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Apelido da carteira <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-nickname`}
                data-testid={`wallet-${kind}-nickname`}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                error={fieldErrors.nickname}
              />
              {fieldErrors.nickname && (
                <p className="mt-1 text-xs text-[#f0805f]">
                  {fieldErrors.nickname}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Rede & Nome do perfil */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor={`wallet-${kind}-network`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Rede <span className="text-[#f0805f]">*</span>
              </label>
              <select
                id={`wallet-${kind}-network`}
                data-testid={`wallet-${kind}-network`}
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
                htmlFor={`wallet-${kind}-profile-name`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Nome do perfil <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-profile-name`}
                data-testid={`wallet-${kind}-profile-name`}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor={`wallet-${kind}-address`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Endereço da carteira <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-address`}
                data-testid={`wallet-${kind}-address`}
                placeholder="Endereço 0x da carteira"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={fieldErrors.address}
              />
              {fieldErrors.address && (
                <p
                  data-testid={`wallet-${kind}-address-error`}
                  className="mt-1 text-xs text-[#f0805f]"
                >
                  {fieldErrors.address}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`wallet-${kind}-secondary-ens`}
                className="block text-xs text-[#f5f1eb] mb-1.5 opacity-0 select-none"
              >
                ENS secundário
              </label>
              <Input
                id={`wallet-${kind}-secondary-ens`}
                placeholder="ENS ou carteira secundária (opcional)"
                value={secondaryEnsOrAddress}
                onChange={(e) => setSecondaryEnsOrAddress(e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Tipo de carteira & Código de indicação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor={`wallet-${kind}-provider`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Tipo de carteira <span className="text-[#f0805f]">*</span>
              </label>
              <select
                id={`wallet-${kind}-provider`}
                data-testid={`wallet-${kind}-provider`}
                value={provider}
                onChange={(e) => setProvider(e.target.value as WalletProvider)}
                className="h-11 w-full rounded-md border border-[#3f2319] bg-[#140d0a] px-3.5 text-sm text-[#f5f1eb] focus:border-[#d28a4c]"
              >
                <option value="MetaMask">MetaMask</option>
                <option value="Coinbase Wallet">Coinbase Wallet</option>
                <option value="WalletConnect">WalletConnect</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`wallet-${kind}-referral`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                Código de indicação <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-referral`}
                data-testid={`wallet-${kind}-referral`}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor={`wallet-${kind}-email`}
                className="block text-xs text-[#f5f1eb] mb-1.5"
              >
                E-mail <span className="text-[#f0805f]">*</span>
              </label>
              <Input
                id={`wallet-${kind}-email`}
                data-testid={`wallet-${kind}-email`}
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
                htmlFor={`wallet-${kind}-ens`}
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
                  id={`wallet-${kind}-ens`}
                  data-testid={`wallet-${kind}-ens`}
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  error={fieldErrors.ensName}
                  className="flex-1"
                />
              </div>
              {fieldErrors.ensName && (
                <p className="mt-1 text-xs text-[#f0805f]">
                  {fieldErrors.ensName}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            data-testid={`wallet-${kind}-save-button`}
            disabled={upsertMutation.isPending}
          >
            {upsertMutation.isPending ? 'Salvando...' : 'Salvar carteira'}
          </Button>
        </form>
      )}
    </section>
  );
}

export function WalletsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id || null;

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => api.wallets.list(signal),
    enabled: Boolean(userId),
  });

  const wallets = walletsQuery.data?.wallets || [];
  const primaryWallet = wallets.find((w) => w.kind === 'primary');
  const secondaryWallet = wallets.find((w) => w.kind === 'secondary');

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AccountSidebar />

        <div className="flex-1 w-full space-y-10">
          {authLoading || !userId || walletsQuery.isLoading ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : (
            <>
              <WalletFormSection
                kind="primary"
                initialWallet={primaryWallet}
                userId={userId}
              />

              <div className="border-t border-[#3f2319] pt-8">
                <WalletFormSection
                  kind="secondary"
                  initialWallet={secondaryWallet}
                  primaryWallet={primaryWallet}
                  userId={userId}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
