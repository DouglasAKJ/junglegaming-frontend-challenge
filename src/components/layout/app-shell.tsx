import React, { useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Search,
  ShoppingCart,
  LogIn,
  User,
  Wallet,
  LogOut,
  Heart,
  Home,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { useCart } from '@/features/cart/use-cart';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';

export function Header() {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const { totalItemsCount } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: '/',
      search: (prev: any) => ({
        ...prev,
        q: searchValue.trim() || undefined,
        page: 1,
      }),
    });
    setSearchOpen(false);
  };

  const handleMercadoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/') {
      const el = document.getElementById('mercado');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(null, '', '/#mercado');
      }
    } else {
      navigate({ to: '/', hash: 'mercado' });
    }
  };

  const handleOutOfScopeNav = (label: string) => {
    addToast({
      title: `Página "${label}" fora do escopo`,
      description:
        'Esta seção editorial não faz parte do escopo funcional da entrega.',
      variant: 'info',
    });
  };

  const isCatalogActive =
    pathname.startsWith('/nft/') ||
    pathname === '/carrinho' ||
    pathname === '/pagamento';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#140d0a]/95 backdrop-blur border-b border-[#3f2319]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          to="/"
          data-testid="site-logo"
          className="text-base md:text-lg font-bold tracking-[0.2em] text-[#f5f1eb] hover:text-[#d28a4c] transition-colors"
        >
          KURIO
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            onClick={() => {
              if (pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                window.history.replaceState(null, '', '/');
              }
            }}
            className={`relative py-2 text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'text-[#d28a4c] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#d28a4c]'
                : 'text-[#f5f1eb] hover:text-[#d28a4c]'
            }`}
          >
            Início
          </Link>
          <a
            href="/#mercado"
            data-testid="header-mercado-link"
            onClick={handleMercadoClick}
            className={`relative py-2 text-sm font-medium transition-colors cursor-pointer ${
              isCatalogActive
                ? 'text-[#d28a4c] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#d28a4c]'
                : 'text-[#f5f1eb] hover:text-[#d28a4c]'
            }`}
          >
            Mercado
          </a>
          <button
            type="button"
            onClick={() => handleOutOfScopeNav('Criadores')}
            className="py-2 text-sm font-medium text-[#f5f1eb] hover:text-[#d28a4c] transition-colors cursor-pointer"
          >
            Criadores
          </button>
          <button
            type="button"
            onClick={() => handleOutOfScopeNav('Aprenda')}
            className="py-2 text-sm font-medium text-[#f5f1eb] hover:text-[#d28a4c] transition-colors cursor-pointer"
          >
            Aprenda
          </button>
        </nav>

        {/* Actions Right */}
        <div className="flex items-center gap-3 md:gap-5">
          {searchOpen ? (
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <input
                type="search"
                data-testid="header-search-input"
                aria-label="Buscar NFTs no catálogo"
                placeholder="Buscar NFT ou coleção..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                autoFocus
                className="h-9 w-44 sm:w-60 rounded-md border border-[#d28a4c] bg-[#241612] px-3 text-xs text-[#f5f1eb] placeholder:text-[#b39463]"
              />
              <Button type="submit" size="sm">
                Buscar
              </Button>
            </form>
          ) : (
            <button
              type="button"
              data-testid="header-search-toggle"
              onClick={() => setSearchOpen(true)}
              aria-label="Abrir busca"
              className="text-[#f5f1eb] hover:text-[#d28a4c] p-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          <Link
            to="/carrinho"
            data-testid="header-cart-link"
            aria-label={`Carrinho de NFTs com ${totalItemsCount} itens`}
            className="relative text-[#f5f1eb] hover:text-[#d28a4c] p-1.5 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            <span
              data-testid="header-cart-badge"
              className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#d28a4c] text-[#140d0a] text-[10px] font-bold flex items-center justify-center"
            >
              {totalItemsCount}
            </span>
          </Link>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/perfil"
                data-testid="header-profile-link"
                className="inline-flex items-center gap-2 rounded-md border border-[#d28a4c] bg-[#241612] px-3 py-1.5 text-xs font-bold text-[#f5f1eb] hover:bg-[#2f1d15] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#d28a4c]" />
                <span className="max-w-28 truncate">{user.displayName}</span>
              </Link>
              <Link
                to="/carteiras"
                data-testid="header-wallets-link"
                aria-label="Minhas Carteiras"
                className="p-2 rounded-md border border-[#3f2319] bg-[#241612] text-[#cfb28c] hover:text-[#f5f1eb] hover:border-[#d28a4c] transition-colors"
              >
                <Wallet className="w-4 h-4" />
              </Link>
              <button
                type="button"
                data-testid="header-logout-button"
                onClick={() => logout()}
                aria-label="Sair da conta"
                className="p-2 rounded-md border border-[#3f2319] bg-[#241612] text-[#f0805f] hover:bg-[#2f1512] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              data-testid="header-login-button"
              size="sm"
              onClick={() => openAuthModal({ mode: 'login' })}
              className="h-9 px-4 text-xs font-bold"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { totalItemsCount } = useCart();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <nav
      aria-label="Navegação inferior mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#241612]/95 backdrop-blur border-t border-[#3f2319] px-6 flex items-center justify-between"
    >
      <Link
        to="/"
        aria-label="Início"
        className={`p-2 rounded-lg transition-colors ${
          pathname === '/' ? 'text-[#d28a4c]' : 'text-[#cfb28c]'
        }`}
      >
        <Home className="w-5 h-5" />
      </Link>

      <button
        type="button"
        aria-label="Meus Favoritos"
        onClick={() => {
          if (!isAuthenticated) {
            openAuthModal({
              mode: 'login',
              reason: 'Entre na sua conta para acessar seus favoritos.',
            });
          } else {
            navigate({ to: '/' });
          }
        }}
        className="p-2 rounded-lg text-[#cfb28c] hover:text-[#d28a4c] cursor-pointer"
      >
        <Heart className="w-5 h-5" />
      </button>

      {/* Center Action Button matching Figma Mobile */}
      <a
        href="/#mercado"
        aria-label="Explorar catálogo"
        onClick={(e) => {
          if (pathname === '/') {
            e.preventDefault();
            const el = document.getElementById('mercado');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
              window.history.replaceState(null, '', '/#mercado');
            }
          } else {
            navigate({ to: '/', hash: 'mercado' });
          }
        }}
        className="-mt-6 w-12 h-12 rounded-full bg-[#d28a4c] text-[#140d0a] shadow-lg flex items-center justify-center border-4 border-[#140d0a] cursor-pointer"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </a>

      <Link
        to="/carrinho"
        aria-label={`Carrinho (${totalItemsCount} itens)`}
        className={`relative p-2 rounded-lg transition-colors ${
          pathname === '/carrinho' ? 'text-[#d28a4c]' : 'text-[#cfb28c]'
        }`}
      >
        <ShoppingCart className="w-5 h-5" />
        {totalItemsCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#d28a4c] text-[#140d0a] text-[10px] font-bold flex items-center justify-center">
            {totalItemsCount}
          </span>
        )}
      </Link>

      <button
        type="button"
        aria-label="Perfil do colecionador"
        onClick={() => {
          if (isAuthenticated) {
            navigate({ to: '/perfil' });
          } else {
            openAuthModal({ mode: 'login' });
          }
        }}
        className={`p-2 rounded-lg transition-colors cursor-pointer ${
          pathname === '/perfil' || pathname === '/carteiras'
            ? 'text-[#d28a4c]'
            : 'text-[#cfb28c]'
        }`}
      >
        <User className="w-5 h-5" />
      </button>
    </nav>
  );
}

export function Footer() {
  const { addToast } = useToast();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.includes('@')) {
      addToast({
        title: 'E-mail inválido',
        description: 'Informe um e-mail válido para receber alertas de lançamentos.',
        variant: 'warning',
      });
      return;
    }
    setNewsletterEmail('');
    addToast({
      title: 'Inscrição registrada',
      description: 'Você receberá novidades dos próximos drops da Kurio.',
      variant: 'success',
    });
  };

  const handleEditorialLink = (label: string) => {
    addToast({
      title: `"${label}" fora do escopo`,
      description:
        'Páginas editoriais, suporte e atividades auxiliares estão fora do escopo funcional.',
      variant: 'info',
    });
  };

  return (
    <footer className="mt-16 pb-20 md:pb-8 bg-[#241612] border-t border-[#3f2319] text-[#cfb28c]">
      {/* Top Feature Highlights + Newsletter matching Figma */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 border-b border-[#3f2319]">
        <div className="flex flex-col gap-3">
          <div className="w-12 h-12 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold text-lg flex items-center justify-center">
            W
          </div>
          <h3 className="text-sm font-bold text-[#f5f1eb]">Segurança da carteira</h3>
          <p className="text-xs leading-relaxed text-[#cfb28c]">
            Proteja sua carteira e colecione arte digital verificada com confiança.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="w-12 h-12 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold text-lg flex items-center justify-center">
            C
          </div>
          <h3 className="text-sm font-bold text-[#f5f1eb]">Criadores em destaque</h3>
          <p className="text-xs leading-relaxed text-[#cfb28c]">
            Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="w-12 h-12 rounded-full bg-[#d28a4c] text-[#140d0a] font-bold text-lg flex items-center justify-center">
            D
          </div>
          <h3 className="text-sm font-bold text-[#f5f1eb]">Alertas de lançamentos</h3>
          <p className="text-xs leading-relaxed text-[#cfb28c]">
            Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#f5f1eb]">
            Antecipe-se ao próximo lançamento
          </h3>
          <form onSubmit={handleNewsletter} className="flex">
            <label htmlFor="footer-newsletter" className="sr-only">
              Seu e-mail para newsletter
            </label>
            <input
              id="footer-newsletter"
              type="email"
              placeholder="digite seu e-mail..."
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-l-md border border-[#3f2319] bg-[#140d0a] px-3 text-xs text-[#f5f1eb] placeholder:text-[#b39463]"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-r-md bg-[#d28a4c] text-[#140d0a] text-xs font-bold hover:bg-[#e89b55] transition-colors cursor-pointer"
            >
              Enviar
            </button>
          </form>
          <p className="text-[11px] leading-relaxed text-[#b39463]">
            Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
          </p>
        </div>
      </div>

      {/* Contact Strip matching Figma */}
      <div className="bg-[#38220f]/60 border-b border-[#3f2319]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="font-bold tracking-widest text-[#f5f1eb]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <span>contato@email.com</span>
          <span>+55 11 4002 8922</span>
        </div>
      </div>

      {/* Links Grid matching Figma */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
        <div>
          <h4 className="font-bold text-sm text-[#f5f1eb] mb-3">Meu perfil</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/perfil" className="hover:text-[#d28a4c]">
                Meu perfil
              </Link>
            </li>
            <li>
              <Link to="/carteiras" className="hover:text-[#d28a4c]">
                Minha coleção / Carteiras
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Atividade')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Atividade
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Estúdio do criador')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Estúdio do criador
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Lista de interesse')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Lista de interesse
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm text-[#f5f1eb] mb-3">Central de ajuda</h4>
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Central de ajuda')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Central de ajuda
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Como comprar NFTs')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Como comprar NFTs
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Carteira e segurança')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Carteira e segurança
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Política do mercado')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Política do mercado
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => handleEditorialLink('Denunciar item')}
                className="hover:text-[#d28a4c] cursor-pointer"
              >
                Denunciar item
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm text-[#f5f1eb] mb-3">Coleções</h4>
          <ul className="space-y-2">
            {(['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] as const).map(
              (cat) => (
                <li key={cat}>
                  <Link
                    to="/"
                    search={{ categories: cat, page: 1 } as any}
                    className="hover:text-[#d28a4c]"
                  >
                    {cat}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-sm text-[#f5f1eb] mb-3">Redes sociais</h4>
          <div className="flex items-center gap-2 mb-6">
            {['F', 'IG', 'X', 'IN', 'YT'].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Rede social ${s}`}
                onClick={() => handleEditorialLink(`Rede social ${s}`)}
                className="w-8 h-8 rounded border border-[#d28a4c]/60 text-[#d28a4c] text-[10px] font-bold flex items-center justify-center hover:bg-[#d28a4c] hover:text-[#140d0a] transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>

          <h4 className="font-bold text-sm text-[#f5f1eb] mb-2">Carteiras compatíveis</h4>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#3f2319] bg-[#140d0a] text-[10px] text-[#d28a4c] font-bold">
            <span>METAMASK</span>
            <span>•</span>
            <span>WALLETCONNECT</span>
            <span>•</span>
            <span>COINBASE</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 border-t border-[#3f2319] text-center text-xs text-[#b39463]">
        © 2026 Kurio. Propriedade digital para todos.
      </div>
    </footer>
  );
}
