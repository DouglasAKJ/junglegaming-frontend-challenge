import React from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  User,
  MapPin,
  ShoppingCart,
  Heart,
  TrendingUp,
  Download,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/ui/toast-provider';

export function AccountSidebar() {
  const { logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const handleOutOfScopeItem = (label: string) => {
    addToast({
      title: `"${label}" fora do escopo`,
      description:
        'Páginas de suporte, atividade, ofertas e downloads não fazem parte do escopo funcional da entrega.',
      variant: 'info',
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/' });
  };

  return (
    <aside
      aria-label="Menu da conta do colecionador"
      className="w-full lg:w-64 shrink-0 rounded-lg bg-[#241612] border border-[#3f2319] overflow-hidden"
    >
      <div className="p-4 border-b border-[#3f2319]">
        <h2 className="text-sm font-bold text-[#f5f1eb]">Meu perfil</h2>
      </div>

      {/* Mobile horizontal tabs + Desktop vertical list */}
      <nav className="flex lg:flex-col overflow-x-auto lg:overflow-visible divide-x lg:divide-x-0 lg:divide-y divide-[#3f2319]/40">
        <Link
          to="/perfil"
          data-testid="account-nav-profile"
          className={`flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap transition-colors ${
            pathname === '/perfil'
              ? 'border-b-2 lg:border-b-0 lg:border-l-4 border-[#d28a4c] text-[#d28a4c] font-bold bg-[#2f1d15]/60'
              : 'text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>Dados do perfil</span>
        </Link>

        <Link
          to="/carteiras"
          data-testid="account-nav-wallets"
          className={`flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap transition-colors ${
            pathname === '/carteiras'
              ? 'border-b-2 lg:border-b-0 lg:border-l-4 border-[#d28a4c] text-[#d28a4c] font-bold bg-[#2f1d15]/60'
              : 'text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span>Carteiras</span>
        </Link>

        <button
          type="button"
          onClick={() => handleOutOfScopeItem('Atividade')}
          className="flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30 text-left cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>Atividade</span>
        </button>

        <button
          type="button"
          onClick={() => handleOutOfScopeItem('Lista de interesse')}
          className="flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30 text-left cursor-pointer"
        >
          <Heart className="w-4 h-4 shrink-0" />
          <span>Lista de interesse</span>
        </button>

        <button
          type="button"
          onClick={() => handleOutOfScopeItem('Ofertas')}
          className="flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30 text-left cursor-pointer"
        >
          <TrendingUp className="w-4 h-4 shrink-0" />
          <span>Ofertas</span>
        </button>

        <button
          type="button"
          onClick={() => handleOutOfScopeItem('Arquivos baixados')}
          className="flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30 text-left cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Arquivos baixados</span>
        </button>

        <button
          type="button"
          onClick={() => handleOutOfScopeItem('Suporte')}
          className="flex items-center gap-3 px-4 py-3 text-xs whitespace-nowrap text-[#cfb28c] hover:text-[#f5f1eb] hover:bg-[#2f1d15]/30 text-left cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Suporte</span>
        </button>

        <button
          type="button"
          data-testid="account-nav-logout"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3.5 text-xs whitespace-nowrap font-bold text-[#d28a4c] hover:bg-[#2f1512]/50 text-left border-t border-[#3f2319] cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sair</span>
        </button>
      </nav>
    </aside>
  );
}
