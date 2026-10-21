import React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  redirect,
} from '@tanstack/react-router';
import { Header, Footer, MobileBottomNav } from '@/components/layout/app-shell';
import { SimulationDevtoolsPanel } from '@/components/layout/sim-devtools';
import { HomePage, HomeSearchParams } from '@/features/catalog/home-page';
import { NftDetailPage } from '@/features/catalog/nft-detail-page';
import { useAuth } from '@/features/auth/auth-context';
import { getStoredToken } from '@/lib/api';

const GlobalAuthDialog = React.lazy(() =>
  import('@/features/auth/auth-modal').then((m) => ({
    default: m.GlobalAuthDialog,
  }))
);
const AuthFormCard = React.lazy(() =>
  import('@/features/auth/auth-modal').then((m) => ({
    default: m.AuthFormCard,
  }))
);
const CartPage = React.lazy(() =>
  import('@/features/cart/cart-page').then((m) => ({ default: m.CartPage }))
);
const CheckoutPage = React.lazy(() =>
  import('@/features/checkout/checkout-page').then((m) => ({
    default: m.CheckoutPage,
  }))
);
const OrderConfirmationPage = React.lazy(() =>
  import('@/features/checkout/order-confirmation-page').then((m) => ({
    default: m.OrderConfirmationPage,
  }))
);
const ProfilePage = React.lazy(() =>
  import('@/features/account/profile-page').then((m) => ({
    default: m.ProfilePage,
  }))
);
const WalletsPage = React.lazy(() =>
  import('@/features/account/wallets-page').then((m) => ({
    default: m.WalletsPage,
  }))
);

function DeferredAuthDialog() {
  const { authModal } = useAuth();
  if (!authModal.isOpen) return null;
  return (
    <React.Suspense fallback={null}>
      <GlobalAuthDialog />
    </React.Suspense>
  );
}

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#140D0A] text-[#f5f1eb]">
      <Header />
      <main id="main-content" className="flex-1">
        <React.Suspense fallback={<div className="min-h-[800px]" />}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <MobileBottomNav />
      <DeferredAuthDialog />
      <SimulationDevtoolsPanel />
    </div>
  );
}

function NotFoundPage() {
  return (
    <div
      data-testid="not-found-page"
      className="max-w-xl mx-auto px-4 py-20 text-center space-y-5"
    >
      <p className="text-4xl font-bold text-[#d28a4c]">404</p>
      <h1 className="text-2xl font-bold text-[#f5f1eb]">
        Página não encontrada na Kurio
      </h1>
      <p className="text-xs sm:text-sm text-[#cfb28c]">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Link
        to="/"
        data-testid="not-found-home-link"
        className="inline-flex items-center justify-center rounded-md bg-[#d28a4c] px-6 py-3 text-xs font-bold text-[#140d0a] hover:bg-[#e89b55]"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

const VALID_TABS = new Set(['all', 'new', 'trending']);
const VALID_SORTS = new Set(['recent', 'price_asc', 'price_desc', 'popular']);

function parseHomeSearch(search: Record<string, unknown>): HomeSearchParams {
  const out: HomeSearchParams = {};
  if (typeof search.q === 'string' && search.q) out.q = search.q;
  if (typeof search.categories === 'string' && search.categories)
    out.categories = search.categories;
  if (typeof search.networks === 'string' && search.networks)
    out.networks = search.networks;
  if (typeof search.minPrice === 'string' && search.minPrice)
    out.minPrice = search.minPrice;
  if (typeof search.maxPrice === 'string' && search.maxPrice)
    out.maxPrice = search.maxPrice;
  if (typeof search.tab === 'string' && VALID_TABS.has(search.tab))
    out.tab = search.tab as HomeSearchParams['tab'];
  if (typeof search.sort === 'string' && VALID_SORTS.has(search.sort))
    out.sort = search.sort as HomeSearchParams['sort'];
  const pageNum = Number(search.page);
  if (Number.isInteger(pageNum) && pageNum > 0) out.page = pageNum;
  return out;
}

function parseAuthSearch(search: Record<string, unknown>): {
  redirect?: string;
  reason?: string;
} {
  return {
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    reason: typeof search.reason === 'string' ? search.reason : undefined,
  };
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseHomeSearch,
  component: function IndexRouteComponent() {
    const search = indexRoute.useSearch();
    return <HomePage search={search} />;
  },
});

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: function NftDetailRouteComponent() {
    const { nftId } = nftDetailRoute.useParams();
    return <NftDetailPage nftId={nftId} />;
  },
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: CartPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: parseAuthSearch,
  component: function LoginRouteComponent() {
    const search = loginRoute.useSearch();
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-xl bg-[#241612] border border-[#3f2319] border-b-4 border-b-[#d28a4c] p-6 sm:p-8 shadow-2xl">
          <AuthFormCard
            initialMode="login"
            redirectTo={search.redirect}
            reason={search.reason}
            isPage
          />
        </div>
      </div>
    );
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: parseAuthSearch,
  component: function RegisterRouteComponent() {
    const search = registerRoute.useSearch();
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-xl bg-[#241612] border border-[#3f2319] border-b-4 border-b-[#d28a4c] p-6 sm:p-8 shadow-2xl">
          <AuthFormCard
            initialMode="register"
            redirectTo={search.redirect}
            reason={search.reason}
            isPage
          />
        </div>
      </div>
    );
  },
});

function requireAuthBeforeLoad(locationHref: string) {
  const token = getStoredToken();
  if (!token) {
    throw redirect({
      to: '/login',
      search: {
        redirect: locationHref,
        reason: 'Autenticação obrigatória para acessar esta área privada.',
      },
    });
  }
}

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: ({ location }) => {
    requireAuthBeforeLoad(location.href);
  },
  component: CheckoutPage,
});

const orderConfirmationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedido/$orderId',
  beforeLoad: ({ location }) => {
    requireAuthBeforeLoad(location.href);
  },
  component: function OrderConfirmationRouteComponent() {
    const { orderId } = orderConfirmationRoute.useParams();
    return <OrderConfirmationPage orderId={orderId} />;
  },
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/perfil',
  beforeLoad: ({ location }) => {
    requireAuthBeforeLoad(location.href);
  },
  component: ProfilePage,
});

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carteiras',
  beforeLoad: ({ location }) => {
    requireAuthBeforeLoad(location.href);
  },
  component: WalletsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  nftDetailRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  checkoutRoute,
  orderConfirmationRoute,
  profileRoute,
  walletsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
