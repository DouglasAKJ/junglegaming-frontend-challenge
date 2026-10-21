import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  CollectionCategory,
  NetworkType,
  SortOption,
  TabFilter,
} from '@/types/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { NftCard } from './nft-card';
import { CatalogGridSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast-provider';

export interface HomeSearchParams {
  q?: string;
  categories?: string; // comma-separated
  networks?: string; // comma-separated
  minPrice?: string;
  maxPrice?: string;
  tab?: TabFilter;
  sort?: SortOption;
  page?: number;
}

const ALL_CATEGORIES: { name: CollectionCategory; defaultCount: number }[] = [
  { name: 'Arte digital', defaultCount: 33 },
  { name: 'Fotografia', defaultCount: 12 },
  { name: 'Música', defaultCount: 65 },
  { name: 'Arte 3D', defaultCount: 39 },
  { name: 'Colecionáveis', defaultCount: 23 },
  { name: 'Generativa', defaultCount: 17 },
  { name: 'Jogos', defaultCount: 19 },
  { name: 'Assinaturas', defaultCount: 13 },
  { name: 'Utilidade', defaultCount: 18 },
];

const ALL_NETWORKS: { name: NetworkType; defaultCount: number }[] = [
  { name: 'Ethereum', defaultCount: 119 },
  { name: 'Polygon', defaultCount: 78 },
  { name: 'Solana', defaultCount: 86 },
];

const HERO_SLIDES = [
  {
    id: 'emerald-ape-042',
    eyebrow: 'Bem-vindo à Kurio',
    titleLine1: 'SEJA DONO DO FUTURO',
    titleLine2: 'DA ARTE DIGITAL',
    description:
      'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    image: '/assets/nfts/ape-emerald.png',
  },
  {
    id: 'sage-nomad-009',
    eyebrow: 'Coleção Kurio Nomads',
    titleLine1: 'EXPLORE OBRAS 3D',
    titleLine2: 'VERIFICADAS NA REDE',
    description:
      'Edições limitadas com procedência imutável armazenada no IPFS e curadoria oficial da comunidade Kurio.',
    image: '/assets/nfts/ape-purple.png',
  },
  {
    id: 'golden-beat-207',
    eyebrow: 'Kurio Sound Drops',
    titleLine1: 'ARTE E MÚSICA',
    titleLine2: 'EM EDIÇÃO LIMITADA',
    description:
      'Colecionáveis audiovisuais com acesso antecipado e direitos verificados por contrato inteligente.',
    image: '/assets/nfts/ape-golden.png',
  },
];

const EDITORIAL_ARTICLES = [
  {
    id: 'art-1',
    date: '12 de setembro',
    readTime: 'Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/assets/nfts/ape-ivory.png',
  },
  {
    id: 'art-2',
    date: '13 de setembro',
    readTime: 'Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Conheça criadores que moldam a cultura digital.',
    image: '/assets/nfts/ape-emerald.png',
  },
  {
    id: 'art-3',
    date: '15 de setembro',
    readTime: 'Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/assets/nfts/ape-purple.png',
  },
  {
    id: 'art-4',
    date: '15 de setembro',
    readTime: 'Leitura de 2 min',
    title: 'Como proteger sua carteira',
    excerpt: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/assets/nfts/ape-golden.png',
  },
];

export function HomePage({ search }: { search: HomeSearchParams }) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const selectedCategories = (search.categories
    ? search.categories.split(',').filter(Boolean)
    : []) as CollectionCategory[];
  const selectedNetworks = (search.networks
    ? search.networks.split(',').filter(Boolean)
    : []) as NetworkType[];

  const currentTab: TabFilter = search.tab || 'all';
  const currentSort: SortOption = search.sort || 'recent';
  const currentPage = Math.max(1, Number(search.page) || 1);
  const currentQuery = search.q || '';

  const [searchInput, setSearchInput] = useState(currentQuery);
  const [minPriceInput, setMinPriceInput] = useState(search.minPrice || '0.02');
  const [maxPriceInput, setMaxPriceInput] = useState(search.maxPrice || '12.30');
  const [heroIndex, setHeroIndex] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setSearchInput(search.q || '');
  }, [search.q]);

  useEffect(() => {
    setMinPriceInput(search.minPrice || '0.02');
    setMaxPriceInput(search.maxPrice || '12.30');
  }, [search.minPrice, search.maxPrice]);

  const queryParams = {
    q: currentQuery || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    networks: selectedNetworks.length > 0 ? selectedNetworks : undefined,
    minPrice: search.minPrice || undefined,
    maxPrice: search.maxPrice || undefined,
    tab: currentTab,
    sort: currentSort,
    page: currentPage,
    limit: 9,
  };

  const catalogQuery = useQuery({
    queryKey: queryKeys.nfts.list(queryParams),
    queryFn: ({ signal }) => api.nfts.list(queryParams, signal),
  });

  const updateSearchParams = (
    updater: (prev: HomeSearchParams) => HomeSearchParams
  ) => {
    navigate({
      to: '/',
      search: (prev: any) => {
        const next = updater(prev || {});
        // Clean undefined/empty keys for clean URL state
        const cleaned: Record<string, any> = {};
        if (next.q) cleaned.q = next.q;
        if (next.categories) cleaned.categories = next.categories;
        if (next.networks) cleaned.networks = next.networks;
        if (next.minPrice) cleaned.minPrice = next.minPrice;
        if (next.maxPrice) cleaned.maxPrice = next.maxPrice;
        if (next.tab && next.tab !== 'all') cleaned.tab = next.tab;
        if (next.sort && next.sort !== 'recent') cleaned.sort = next.sort;
        if (next.page && next.page > 1) cleaned.page = next.page;
        return cleaned;
      },
    });
  };

  const toggleCategory = (cat: CollectionCategory) => {
    const exists = selectedCategories.includes(cat);
    const next = exists
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    updateSearchParams((prev) => ({
      ...prev,
      categories: next.length > 0 ? next.join(',') : undefined,
      page: 1, // Filter change resets pagination!
    }));
  };

  const toggleNetwork = (net: NetworkType) => {
    const exists = selectedNetworks.includes(net);
    const next = exists
      ? selectedNetworks.filter((n) => n !== net)
      : [...selectedNetworks, net];
    updateSearchParams((prev) => ({
      ...prev,
      networks: next.length > 0 ? next.join(',') : undefined,
      page: 1, // Filter change resets pagination!
    }));
  };

  const handleApplyPriceFilter = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams((prev) => ({
      ...prev,
      minPrice: minPriceInput.trim() || undefined,
      maxPrice: maxPriceInput.trim() || undefined,
      page: 1,
    }));
    setMobileFiltersOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams((prev) => ({
      ...prev,
      q: searchInput.trim() || undefined,
      page: 1,
    }));
  };

  const handleClearAllFilters = () => {
    setSearchInput('');
    setMinPriceInput('0.02');
    setMaxPriceInput('12.30');
    navigate({ to: '/', search: {} });
  };

  const activeSlide = HERO_SLIDES[heroIndex] || HERO_SLIDES[0];

  const renderFilterSidebarContent = () => (
    <div className="space-y-8">
      {/* Coleções */}
      <div>
        <h2 className="text-base font-bold text-[#f5f1eb] mb-4">Coleções</h2>
        <ul className="space-y-2.5">
          {ALL_CATEGORIES.map(({ name, defaultCount }) => {
            const isSelected = selectedCategories.includes(name);
            const count =
              catalogQuery.data?.facets?.categories?.[name] ?? defaultCount;
            return (
              <li key={name}>
                <button
                  type="button"
                  data-testid={`filter-category-${name}`}
                  onClick={() => toggleCategory(name)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center justify-between text-xs py-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-[#d28a4c] font-bold'
                      : 'text-[#cfb28c] hover:text-[#f5f1eb]'
                  }`}
                >
                  <span>{name}</span>
                  <span
                    className={
                      isSelected ? 'text-[#d28a4c] font-bold' : 'text-[#b39463]'
                    }
                  >
                    ({count})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Faixa de preço */}
      <div>
        <h2 className="text-base font-bold text-[#f5f1eb] mb-4">Faixa de preço</h2>
        <form onSubmit={handleApplyPriceFilter} className="space-y-3">
          {/* Visual dual-thumb track matching Figma */}
          <div className="relative h-2 w-full rounded-full bg-[#3f2319] my-3">
            <div className="absolute left-[8%] right-[25%] top-0 bottom-0 rounded-full bg-[#d28a4c]" />
            <div className="absolute left-[8%] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#d28a4c] border-2 border-[#140d0a]" />
            <div className="absolute right-[25%] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#d28a4c] border-2 border-[#140d0a]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="min-price-input" className="text-[11px] text-[#cfb28c]">
                Mín (ETH)
              </label>
              <input
                id="min-price-input"
                data-testid="filter-min-price"
                type="text"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-[#3f2319] bg-[#140d0a] px-2 text-xs text-[#f5f1eb]"
              />
            </div>
            <div>
              <label htmlFor="max-price-input" className="text-[11px] text-[#cfb28c]">
                Máx (ETH)
              </label>
              <input
                id="max-price-input"
                data-testid="filter-max-price"
                type="text"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="mt-1 h-8 w-full rounded border border-[#3f2319] bg-[#140d0a] px-2 text-xs text-[#f5f1eb]"
              />
            </div>
          </div>

          <p className="text-xs text-[#cfb28c]">
            Preço:{' '}
            <span className="text-[#d28a4c] font-bold">
              {minPriceInput.replace('.', ',')} - {maxPriceInput.replace('.', ',')} ETH
            </span>
          </p>

          <Button
            type="submit"
            data-testid="filter-apply-price"
            size="sm"
            className="px-5"
          >
            Aplicar
          </Button>
        </form>
      </div>

      {/* Rede */}
      <div>
        <h2 className="text-base font-bold text-[#f5f1eb] mb-4">Rede</h2>
        <ul className="space-y-2.5">
          {ALL_NETWORKS.map(({ name, defaultCount }) => {
            const isSelected = selectedNetworks.includes(name);
            const count =
              catalogQuery.data?.facets?.networks?.[name] ?? defaultCount;
            return (
              <li key={name}>
                <button
                  type="button"
                  data-testid={`filter-network-${name}`}
                  onClick={() => toggleNetwork(name)}
                  aria-pressed={isSelected}
                  className={`w-full flex items-center justify-between text-xs py-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-[#d28a4c] font-bold'
                      : 'text-[#cfb28c] hover:text-[#f5f1eb]'
                  }`}
                >
                  <span>{name}</span>
                  <span
                    className={
                      isSelected ? 'text-[#d28a4c] font-bold' : 'text-[#b39463]'
                    }
                  >
                    ({count})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {(selectedCategories.length > 0 ||
        selectedNetworks.length > 0 ||
        search.minPrice ||
        search.maxPrice ||
        search.q) && (
        <button
          type="button"
          data-testid="filter-clear-all"
          onClick={handleClearAllFilters}
          className="inline-flex items-center gap-1.5 text-xs text-[#d28a4c] hover:underline cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar todos os filtros</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
      {/* Mobile Top Search & Filter Bar matching Mobile / Início frame */}
      <div className="flex md:hidden items-center gap-3 mb-5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-[#d28a4c] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            data-testid="mobile-search-input"
            aria-label="Explorar coleções"
            placeholder="Explorar coleções"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              updateSearchParams((prev) => ({
                ...prev,
                q: e.target.value.trim() || undefined,
                page: 1,
              }));
            }}
            className="w-full h-11 rounded-xl bg-[#241612] border border-[#3f2319] pl-10 pr-4 text-xs text-[#f5f1eb] placeholder:text-[#b39463]"
          />
        </form>
        <button
          type="button"
          data-testid="mobile-filter-button"
          onClick={() => setMobileFiltersOpen(true)}
          aria-label="Abrir filtros de busca"
          className="w-11 h-11 rounded-xl bg-[#d28a4c] text-[#140d0a] flex items-center justify-center shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Hero Section matching Desktop & Mobile Figma (no card wrapper, directly on #140D0A) */}
      <section
        aria-label="Destaque principal"
        className="relative bg-[#140D0A] py-2 sm:py-4 lg:py-6 mb-8 md:mb-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs sm:text-sm font-bold text-[#f5f1eb]">
              {activeSlide.eyebrow}
            </p>
            <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#f5f1eb] leading-tight">
              {activeSlide.titleLine1}
              <br />
              {activeSlide.titleLine2}
            </h1>
            <p className="text-xs sm:text-sm text-[#cfb28c] max-w-xl leading-relaxed">
              {activeSlide.description}
            </p>
            <div className="pt-2">
              <Link
                to="/nft/$nftId"
                params={{ nftId: activeSlide.id }}
                data-testid="hero-explore-cta"
                className="inline-flex items-center gap-2 rounded-md bg-[#d28a4c] px-6 py-3 text-xs sm:text-sm font-bold text-[#140D0A] hover:bg-[#e89b55] transition-colors"
              >
                <span>EXPLORAR</span>
                <ArrowRight className="w-4 h-4 md:hidden" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <Link
              to="/nft/$nftId"
              params={{ nftId: activeSlide.id }}
              className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden block"
            >
              <img
                src={activeSlide.image}
                alt={activeSlide.titleLine1}
                fetchPriority="high"
                width={420}
                height={420}
                className="w-full h-full object-cover"
              />
            </Link>
          </div>
        </div>

        {/* Hero Carousel Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {HERO_SLIDES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Ir para destaque ${idx + 1}`}
              onClick={() => setHeroIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer ${
                idx === heroIndex ? 'bg-[#d28a4c]' : 'bg-[#55321f]'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Main Catalog Area: Left Sidebar + Right Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Filtros do catálogo"
          className="hidden lg:block lg:col-span-3 space-y-6"
        >
          <div className="rounded-xl bg-[#241612]/80 border border-[#3f2319] p-5">
            {renderFilterSidebarContent()}
          </div>

          {/* NFT EM DESTAQUE / OFERTA LIMITADA matching Figma sidebar */}
          <div className="rounded-xl bg-[#241612]/80 border border-[#3f2319] p-4 text-center">
            <p className="text-sm font-bold text-[#d28a4c] tracking-wide">
              NFT EM DESTAQUE
            </p>
            <p className="text-xs font-bold text-[#f5f1eb] mt-1 mb-3">
              OFERTA LIMITADA
            </p>
            <Link
              to="/nft/$nftId"
              params={{ nftId: 'sage-nomad-009' }}
              className="block rounded-xl overflow-hidden aspect-[4/5]"
            >
              <img
                src="/assets/nfts/ape-purple.png"
                alt="NFT em Destaque Sage Nomad #009"
                loading="lazy"
                width={280}
                height={350}
                className="w-full h-full object-cover hover:scale-105 transition-transform"
              />
            </Link>
          </div>
        </aside>

        {/* Right Catalog Content */}
        <section aria-label="Catálogo de NFTs" className="lg:col-span-9">
          {/* Desktop Search + Tabs + Sort Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#3f2319]">
            {/* Tabs: Todos os NFTs | Novos lançamentos | Em alta */}
            <div
              role="tablist"
              aria-label="Filtro rápido de abas"
              className="flex items-center gap-5 overflow-x-auto"
            >
              {(
                [
                  { id: 'all', label: 'Todos os NFTs' },
                  { id: 'new', label: 'Novos lançamentos' },
                  { id: 'trending', label: 'Em alta' },
                ] as const
              ).map((t) => {
                const active = currentTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    data-testid={`catalog-tab-${t.id}`}
                    aria-selected={active}
                    onClick={() =>
                      updateSearchParams((prev) => ({
                        ...prev,
                        tab: t.id,
                        page: 1,
                      }))
                    }
                    className={`relative pb-2 text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'text-[#d28a4c] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#d28a4c]'
                        : 'text-[#f5f1eb] hover:text-[#cfb28c]'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop Search + Sort */}
            <div className="flex flex-wrap items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center">
                <label htmlFor="catalog-search-input" className="sr-only">
                  Buscar no catálogo
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#b39463] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="catalog-search-input"
                    data-testid="catalog-search-input"
                    type="search"
                    placeholder="Buscar NFT..."
                    value={searchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchInput(val);
                      updateSearchParams((prev) => ({
                        ...prev,
                        q: val.trim() || undefined,
                        page: 1,
                      }));
                    }}
                    className="h-9 w-48 rounded-md border border-[#3f2319] bg-[#241612] pl-8 pr-3 text-xs text-[#f5f1eb] placeholder:text-[#b39463]"
                  />
                </div>
              </form>

              <div className="flex items-center gap-2 text-xs text-[#cfb28c]">
                <label htmlFor="catalog-sort-select" className="whitespace-nowrap">
                  Ordenar por:
                </label>
                <select
                  id="catalog-sort-select"
                  data-testid="catalog-sort-select"
                  value={currentSort}
                  onChange={(e) =>
                    updateSearchParams((prev) => ({
                      ...prev,
                      sort: e.target.value as SortOption,
                      page: 1,
                    }))
                  }
                  className="h-9 rounded-md border border-[#3f2319] bg-[#241612] px-2.5 text-xs text-[#f5f1eb] focus:border-[#d28a4c] cursor-pointer"
                >
                  <option value="recent">Listados recentemente</option>
                  <option value="price_asc">Menor preço (ETH)</option>
                  <option value="price_desc">Maior preço (ETH)</option>
                  <option value="popular">Mais populares</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Pills */}
          {(selectedCategories.length > 0 ||
            selectedNetworks.length > 0 ||
            search.q ||
            search.minPrice ||
            search.maxPrice) && (
            <div
              data-testid="active-filters-bar"
              className="flex flex-wrap items-center gap-2 mb-5"
            >
              {search.q && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#241612] border border-[#d28a4c] text-xs text-[#f5f1eb]">
                  Busca: "{search.q}"
                </span>
              )}
              {selectedCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#241612] border border-[#d28a4c] text-xs text-[#d28a4c] cursor-pointer"
                >
                  <span>{c}</span>
                  <span>×</span>
                </button>
              ))}
              {selectedNetworks.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNetwork(n)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#241612] border border-[#d28a4c] text-xs text-[#d28a4c] cursor-pointer"
                >
                  <span>{n}</span>
                  <span>×</span>
                </button>
              ))}
              <button
                type="button"
                data-testid="clear-filters-inline"
                onClick={handleClearAllFilters}
                className="text-xs text-[#cfb28c] underline hover:text-[#f5f1eb] ml-2 cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Catalog States: Loading Skeleton, Error, Empty, Success Grid */}
          {catalogQuery.isLoading ? (
            <CatalogGridSkeleton count={6} />
          ) : catalogQuery.isError ? (
            <div
              role="alert"
              data-testid="catalog-error-state"
              className="rounded-xl border border-[#f0805f] bg-[#241612] p-8 text-center space-y-4"
            >
              <AlertTriangle className="w-10 h-10 text-[#f0805f] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#f5f1eb]">
                  Falha ao carregar o catálogo
                </h3>
                <p className="text-xs text-[#cfb28c] max-w-md mx-auto">
                  {catalogQuery.error instanceof Error
                    ? catalogQuery.error.message
                    : 'Não foi possível buscar os NFTs neste momento.'}
                </p>
              </div>
              <Button
                type="button"
                data-testid="catalog-retry-button"
                onClick={() => catalogQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : !catalogQuery.data || catalogQuery.data.items.length === 0 ? (
            <div
              data-testid="catalog-empty-state"
              className="rounded-xl border border-[#3f2319] bg-[#241612]/60 p-10 text-center space-y-4"
            >
              <h3 className="text-base font-bold text-[#f5f1eb]">
                Nenhum NFT encontrado para os filtros selecionados
              </h3>
              <p className="text-xs text-[#cfb28c] max-w-md mx-auto">
                Tente ajustar os termos da busca, faixa de preço ou categorias para descobrir outras obras da Kurio.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleClearAllFilters}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <div
                data-testid="catalog-grid"
                className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
              >
                {catalogQuery.data.items.map((nft) => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
              </div>

              {/* Pagination matching Figma bottom-right */}
              <nav
                aria-label="Paginação do catálogo"
                className="flex items-center justify-end gap-2 mt-8"
              >
                {Array.from({
                  length: Math.max(4, catalogQuery.data.totalPages),
                }).map((_, idx) => {
                  const pageNum = idx + 1;
                  const isCurrent = pageNum === currentPage;
                  const isDisabled = pageNum > (catalogQuery.data?.totalPages || 1);
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      data-testid={`pagination-page-${pageNum}`}
                      disabled={isDisabled}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={() =>
                        updateSearchParams((prev) => ({
                          ...prev,
                          page: pageNum,
                        }))
                      }
                      className={`w-8 h-8 rounded text-xs font-bold flex items-center justify-center border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#d28a4c] border-[#d28a4c] text-[#140d0a]'
                          : isDisabled
                            ? 'bg-[#241612]/40 border-[#3f2319] text-[#b39463]/40 cursor-not-allowed'
                            : 'bg-[#241612] border-[#3f2319] text-[#f5f1eb] hover:border-[#d28a4c]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-testid="pagination-next"
                  disabled={currentPage >= (catalogQuery.data.totalPages || 1)}
                  aria-label="Próxima página"
                  onClick={() =>
                    updateSearchParams((prev) => ({
                      ...prev,
                      page: currentPage + 1,
                    }))
                  }
                  className="w-8 h-8 rounded bg-[#241612] border border-[#3f2319] text-[#f5f1eb] hover:border-[#d28a4c] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            </>
          )}
        </section>
      </div>

      {/* Promo Banners matching Figma Desktop / Início */}
      <section
        aria-label="Coleções em destaque"
        className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="rounded-xl bg-[#241612] border border-[#3f2319] p-6 flex flex-col sm:flex-row items-center gap-6">
          <img
            src="/assets/nfts/ape-emerald.png"
            alt="Lançamentos gênesis"
            loading="lazy"
            width={220}
            height={220}
            className="w-full sm:w-48 aspect-square rounded-xl object-cover shrink-0"
          />
          <div className="flex-1 text-left sm:text-right space-y-3">
            <h2 className="text-base font-bold text-[#f5f1eb]">
              Lançamentos gênesis de edição limitada
            </h2>
            <p className="text-xs text-[#cfb28c] leading-relaxed">
              Colecione edições escassas diretamente dos criadores antes da revelação pública.
            </p>
            <Link
              to="/nft/$nftId"
              params={{ nftId: 'emerald-ape-042' }}
              className="inline-flex items-center gap-2 rounded-md bg-[#d28a4c] px-4 py-2 text-xs font-bold text-[#140d0a] hover:bg-[#e89b55]"
            >
              <span>Explorar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-[#241612] border border-[#3f2319] p-6 flex flex-col sm:flex-row items-center gap-6">
          <img
            src="/assets/nfts/ape-ivory.png"
            alt="Arte digital selecionada"
            loading="lazy"
            width={220}
            height={220}
            className="w-full sm:w-48 aspect-square rounded-xl object-cover shrink-0"
          />
          <div className="flex-1 text-left sm:text-right space-y-3">
            <h2 className="text-base font-bold text-[#f5f1eb]">
              Arte digital selecionada e muito mais
            </h2>
            <p className="text-xs text-[#cfb28c] leading-relaxed">
              Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.
            </p>
            <Link
              to="/nft/$nftId"
              params={{ nftId: 'neon-vessel-552' }}
              className="inline-flex items-center gap-2 rounded-md bg-[#d28a4c] px-4 py-2 text-xs font-bold text-[#140d0a] hover:bg-[#e89b55]"
            >
              <span>Explorar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Diário da Cunhagem section matching Figma */}
      <section aria-label="Diário da Cunhagem" className="mt-16">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-[#f5f1eb]">
            Diário da Cunhagem
          </h2>
          <p className="text-xs text-[#cfb28c]">
            Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {EDITORIAL_ARTICLES.map((art) => (
            <article
              key={art.id}
              className="rounded-xl bg-[#241612] border border-[#3f2319] overflow-hidden flex flex-col"
            >
              <img
                src={art.image}
                alt={art.title}
                loading="lazy"
                width={300}
                height={220}
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#b39463]">
                    {art.date} | {art.readTime}
                  </p>
                  <h3 className="text-sm font-bold text-[#f5f1eb] leading-snug">
                    {art.title}
                  </h3>
                  <p className="text-xs text-[#cfb28c] leading-relaxed">
                    {art.excerpt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addToast({
                      title: 'Artigo editorial fora do escopo',
                      description:
                        'Páginas editoriais não fazem parte da entrega funcional.',
                      variant: 'info',
                    })
                  }
                  className="text-xs font-bold text-[#d28a4c] hover:underline self-start cursor-pointer"
                >
                  Ler mais →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Mobile Filter Drawer Dialog */}
      <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <DialogContent data-testid="mobile-filters-dialog">
          <DialogTitle>Filtrar Coleções</DialogTitle>
          <DialogDescription>
            Combine coleções, faixa de preço em ETH e redes blockchain.
          </DialogDescription>
          <div className="mt-2">{renderFilterSidebarContent()}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
