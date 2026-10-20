import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { api, AppApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/features/auth/auth-context';
import { AccountSidebar } from './account-sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';

const AVATAR_PRESETS = [
  '/assets/nfts/ape-emerald.png',
  '/assets/nfts/ape-purple.png',
  '/assets/nfts/ape-ivory.png',
  '/assets/nfts/ape-golden.png',
];

export function ProfilePage() {
  const { user, updateUserInContext } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id || null;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => api.profile.get(signal),
    enabled: Boolean(userId),
  });

  const profile = profileQuery.data || user;

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [ensName, setEnsName] = useState(profile?.ensName || '');
  const [ensDomain, setEnsDomain] = useState<'.eth' | '.kurio.eth' | '.xyz'>(
    profile?.ensDomain || '.eth'
  );
  const [walletNickname, setWalletNickname] = useState(
    profile?.walletNickname || 'Principal'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatarUrl || null
  );

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setUsername(profile.username);
      setEmail(profile.email);
      setEnsName(profile.ensName);
      setEnsDomain(profile.ensDomain || '.eth');
      setWalletNickname(profile.walletNickname);
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile?.id]);

  const updateProfileMutation = useMutation({
    mutationFn: api.profile.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile(userId), updated);
      updateUserInContext(updated);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: api.profile.changePassword,
  });

  const handleCycleAvatar = () => {
    const currentIdx = avatarUrl ? AVATAR_PRESETS.indexOf(avatarUrl) : -1;
    const nextIdx = (currentIdx + 1) % AVATAR_PRESETS.length;
    setAvatarUrl(AVATAR_PRESETS[nextIdx]);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) {
      errs.displayName = 'Nome de exibição deve ter pelo menos 2 caracteres';
    }
    if (username.trim().length < 3) {
      errs.username = 'Nome de usuário deve ter pelo menos 3 caracteres';
    }
    if (!email.trim().includes('@')) {
      errs.email = 'E-mail inválido';
    }
    if (ensName.trim().length < 2) {
      errs.ensName = 'Nome ENS obrigatório';
    }
    if (walletNickname.trim().length < 2) {
      errs.walletNickname = 'Apelido da carteira obrigatório';
    }

    const wantsPasswordChange =
      Boolean(currentPassword) ||
      Boolean(newPassword) ||
      Boolean(confirmNewPassword);

    if (wantsPasswordChange) {
      if (currentPassword.length < 6) {
        errs.currentPassword = 'Informe sua senha atual';
      }
      if (newPassword.length < 6) {
        errs.newPassword = 'A nova senha deve ter pelo menos 6 caracteres';
      }
      if (confirmNewPassword !== newPassword) {
        errs.confirmNewPassword = 'A confirmação da nova senha não confere';
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        ensName: ensName.trim(),
        ensDomain,
        walletNickname: walletNickname.trim(),
        avatarUrl,
      });

      if (wantsPasswordChange) {
        await changePasswordMutation.mutateAsync({
          currentPassword,
          newPassword,
          confirmNewPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }

      addToast({
        title: 'Perfil atualizado!',
        description: wantsPasswordChange
          ? 'Seus dados e sua nova senha foram salvos com sucesso.'
          : 'As alterações no seu perfil foram salvas.',
        variant: 'success',
      });
    } catch (err) {
      if (err instanceof AppApiError) {
        setGeneralError(err.message);
        if (err.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...err.fieldErrors }));
        }
      } else {
        setGeneralError('Não foi possível salvar as alterações agora.');
      }
    }
  };

  if (profileQuery.isLoading && !profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <AccountSidebar />

        <div className="flex-1 w-full">
          <h1 className="text-base font-bold text-[#f5f1eb] mb-6">
            Perfil do colecionador
          </h1>

          {generalError && (
            <div
              role="alert"
              data-testid="profile-error-banner"
              className="mb-6 flex items-center gap-2 rounded-md border border-[#f0805f] bg-[#2f1512] p-3 text-xs text-[#f5f1eb]"
            >
              <AlertCircle className="w-4 h-4 text-[#f0805f] shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSave} noValidate className="space-y-6">
            {/* Row 1: Nome de exibição & Nome de usuário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome de exibição <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="profile-display-name"
                  data-testid="profile-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  error={fieldErrors.displayName}
                  aria-describedby={
                    fieldErrors.displayName ? 'err-profile-display-name' : undefined
                  }
                />
                {fieldErrors.displayName && (
                  <p
                    id="err-profile-display-name"
                    className="mt-1 text-xs text-[#f0805f]"
                  >
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-username"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nome de usuário <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="profile-username"
                  data-testid="profile-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  error={fieldErrors.username}
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.username}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: E-mail & Nome ENS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="profile-email"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  E-mail <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="profile-email"
                  data-testid="profile-email"
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
                  htmlFor="profile-ens-name"
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
                    id="profile-ens-name"
                    data-testid="profile-ens-name"
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

            {/* Row 3: Apelido da carteira & Avatar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <label
                  htmlFor="profile-wallet-nickname"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Apelido da carteira <span className="text-[#f0805f]">*</span>
                </label>
                <Input
                  id="profile-wallet-nickname"
                  data-testid="profile-wallet-nickname"
                  value={walletNickname}
                  onChange={(e) => setWalletNickname(e.target.value)}
                  error={fieldErrors.walletNickname}
                />
                {fieldErrors.walletNickname && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.walletNickname}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs text-[#f5f1eb] mb-1.5">
                  Avatar
                </span>
                <div className="flex items-center gap-4">
                  <div
                    data-testid="profile-avatar-preview"
                    className="w-11 h-11 rounded-full border border-[#55321f] bg-[#241612] overflow-hidden flex items-center justify-center shrink-0"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar do colecionador"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-[#d28a4c]" />
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    data-testid="profile-avatar-change"
                    onClick={handleCycleAvatar}
                  >
                    Alterar
                  </Button>

                  <button
                    type="button"
                    data-testid="profile-avatar-remove"
                    onClick={handleRemoveAvatar}
                    className="text-xs text-[#f5f1eb] hover:text-[#f0805f] cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>

            {/* Alterar senha section matching Figma */}
            <div className="pt-4 space-y-4 max-w-md">
              <h2 className="text-sm font-bold text-[#f5f1eb]">Alterar senha</h2>

              <div>
                <label
                  htmlFor="profile-current-password"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Senha atual
                </label>
                <div className="relative">
                  <Input
                    id="profile-current-password"
                    data-testid="profile-current-password"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    error={fieldErrors.currentPassword}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    aria-label="Alternar visibilidade da senha atual"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d28a4c] cursor-pointer"
                  >
                    {showCurrentPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.currentPassword && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.currentPassword}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-new-password"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    id="profile-new-password"
                    data-testid="profile-new-password"
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    error={fieldErrors.newPassword}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    aria-label="Alternar visibilidade da nova senha"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d28a4c] cursor-pointer"
                  >
                    {showNewPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.newPassword && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="profile-confirm-password"
                  className="block text-xs text-[#f5f1eb] mb-1.5"
                >
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Input
                    id="profile-confirm-password"
                    data-testid="profile-confirm-password"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    error={fieldErrors.confirmNewPassword}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    aria-label="Alternar visibilidade da confirmação de senha"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d28a4c] cursor-pointer"
                  >
                    {showConfirmPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.confirmNewPassword && (
                  <p className="mt-1 text-xs text-[#f0805f]">
                    {fieldErrors.confirmNewPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                data-testid="profile-save-button"
                disabled={
                  updateProfileMutation.isPending ||
                  changePasswordMutation.isPending
                }
                className="px-8"
              >
                {updateProfileMutation.isPending ||
                changePasswordMutation.isPending
                  ? 'Salvando...'
                  : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
