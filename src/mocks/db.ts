import {
  NftItem,
  UserProfile,
  WalletItem,
  CartItem,
  OrderReceipt,
  EditionType,
  CollectionCategory,
  NetworkType,
} from '@/types/contracts';
import { addEth, mulEth, percentOfEth, subEth, formatEthPrecise } from '@/lib/eth';

const STORAGE_KEY = 'kurio_mock_db_v1';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface CouponRecord {
  code: string;
  discountPercent: number;
  expiresAt: string; // ISO string
  description: string;
}

export interface SimulationConfig {
  latencyMs: number;
  jitterMs: number;
  outOfOrderCatalog: boolean;
  failNextRequest: boolean;
  forceHttpError: number | null; // e.g., 500, 503, 401
  forceSessionExpired: boolean;
  orderOutcome: 'confirm' | 'decline' | 'timeout_then_pending';
  walletActionOutcome: 'success' | 'reject' | 'disconnect';
  orderConfirmationDelayMs: number;
}

export interface MockDbState {
  users: StoredUser[];
  sessions: Record<string, { userId: string; expiresAt: string }>;
  nfts: NftItem[];
  favoritesByUser: Record<string, string[]>; // userId -> nftIds[]
  cartsByOwner: Record<string, { items: CartItem[]; couponCode: string | null }>; // userId or 'guest'
  walletsByUser: Record<string, WalletItem[]>;
  orders: OrderReceipt[];
  coupons: CouponRecord[];
  sim: SimulationConfig;
  eventCounter: number;
}

const DEFAULT_SIM: SimulationConfig = {
  latencyMs: 20,
  jitterMs: 5,
  outOfOrderCatalog: false,
  failNextRequest: false,
  forceHttpError: null,
  forceSessionExpired: false,
  orderOutcome: 'confirm',
  walletActionOutcome: 'success',
  orderConfirmationDelayMs: 600,
};

function simpleHash(password: string): string {
  // Deterministic non-cleartext hash for mock verification
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return `khash_${(hash >>> 0).toString(16)}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return simpleHash(password) === hash;
}

export function hashPassword(password: string): string {
  return simpleHash(password);
}

const BASE_NFTS: NftItem[] = [
  {
    id: 'emerald-ape-042',
    tokenId: '#0042',
    title: 'Emerald Ape #042',
    collectionName: 'Kurio Apes',
    category: 'Arte digital',
    network: 'Ethereum',
    priceEth: '1.19',
    image: '/assets/nfts/ape-emerald.png',
    gallery: [
      '/assets/nfts/ape-emerald.png',
      '/assets/nfts/ape-emerald.png',
      '/assets/nfts/ape-emerald.png',
      '/assets/nfts/ape-emerald.png',
    ],
    isFeatured: true,
    isNewRelease: true,
    isTrending: true,
    rating: 4.8,
    reviewsCount: 19,
    reviews: [
      {
        id: 'rev-1',
        author: 'nova.kurio.eth',
        rating: 5,
        comment: 'Acabamento impecável e metadados verificados no IPFS. Uma peça essencial da coleção Kurio Editions.',
        date: '2026-07-15',
      },
      {
        id: 'rev-2',
        author: 'kai.collector.eth',
        rating: 5,
        comment: 'A paleta esmeralda e os óculos retrô destacam muito na galeria.',
        date: '2026-07-18',
      },
    ],
    shortDescription:
      'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
    fullDescription:
      'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.\n\nA propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    creator: 'Nova Sato',
    royaltyPercent: 5,
    contractAddress: '0x7A42...19E8',
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '3.50', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.89', available: 4, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.19', available: 15, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.79', available: 100, totalSupply: 200 },
    ],
    createdAt: '2026-07-28T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'sage-nomad-009',
    tokenId: '#0009',
    title: 'Sage Nomad #009',
    collectionName: 'Kurio Nomads',
    category: 'Arte 3D',
    network: 'Ethereum',
    priceEth: '1.69',
    image: '/assets/nfts/ape-purple.png',
    gallery: [
      '/assets/nfts/ape-purple.png',
      '/assets/nfts/ape-emerald.png',
      '/assets/nfts/ape-ivory.png',
      '/assets/nfts/ape-golden.png',
    ],
    isFeatured: true,
    isNewRelease: true,
    isTrending: false,
    rating: 4.9,
    reviewsCount: 14,
    reviews: [
      {
        id: 'rev-3',
        author: 'art.vault.eth',
        rating: 5,
        comment: 'Texturas 3D impressionantes e iluminação suave.',
        date: '2026-07-12',
      },
    ],
    shortDescription:
      'Explorador nômade esculpido em 3D com iluminação volumétrica e registro imutável na rede Ethereum.',
    fullDescription:
      'Sage Nomad #009 faz parte da série Kurio Nomads, celebrando viajantes do metaverso com vestimentas urbanas e chapéu bucket clássico.',
    creator: 'Kenji Takahashi',
    royaltyPercent: 5,
    contractAddress: '0x8B11...42F1',
    attributes: ['Bucket Hat', 'Sábio', 'Urbano'],
    defaultEdition: '1/10',
    editions: [
      { edition: '1/1', priceEth: '4.20', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.69', available: 6, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.15', available: 22, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.65', available: 80, totalSupply: 150 },
    ],
    createdAt: '2026-07-27T14:30:00.000Z',
    version: 1,
  },
  {
    id: 'neon-vessel-552',
    tokenId: '#0552',
    title: 'Neon Vessel #552',
    collectionName: 'Kurio Vessels',
    category: 'Arte digital',
    network: 'Ethereum',
    priceEth: '1.99',
    originalPriceEth: '2.29',
    badge: 'RARO',
    image: '/assets/nfts/ape-ivory.png',
    gallery: [
      '/assets/nfts/ape-ivory.png',
      '/assets/nfts/ape-emerald.png',
      '/assets/nfts/ape-purple.png',
      '/assets/nfts/ape-golden.png',
    ],
    isFeatured: false,
    isNewRelease: false,
    isTrending: true,
    rating: 4.7,
    reviewsCount: 23,
    reviews: [],
    shortDescription:
      'Retrato de alfaiataria contemporânea com acabamento monocromático e detalhes em ouro.',
    fullDescription:
      'Neon Vessel #552 combina estética editorial clássica com identidade criptográfica verificada.',
    creator: 'Elena Vance',
    royaltyPercent: 5,
    contractAddress: '0x3C90...88A2',
    attributes: ['Alfaiataria', 'Brinco Ouro', 'Raro'],
    defaultEdition: '1/10',
    editions: [
      { edition: '1/1', priceEth: '5.00', available: 0, totalSupply: 1 }, // Esgotada para exercitar edição indisponível!
      { edition: '1/10', priceEth: '1.99', originalPriceEth: '2.29', available: 5, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.29', available: 18, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.89', available: 45, totalSupply: 100 },
    ],
    createdAt: '2026-07-26T09:15:00.000Z',
    version: 1,
  },
  {
    id: 'cosmic-bloom-118',
    tokenId: '#0118',
    title: 'Cosmic Bloom #118',
    collectionName: 'Kurio Apes',
    category: 'Colecionáveis',
    network: 'Polygon',
    priceEth: '1.29',
    image: '/assets/nfts/ape-purple.png',
    gallery: ['/assets/nfts/ape-purple.png', '/assets/nfts/ape-golden.png'],
    isFeatured: false,
    isNewRelease: true,
    isTrending: true,
    rating: 4.6,
    reviewsCount: 11,
    reviews: [],
    shortDescription:
      'Edição cósmica cunhada na Polygon com taxas reduzidas e desbloqueio de comunidade.',
    fullDescription:
      'Cosmic Bloom #118 sintetiza a cultura street e colecionáveis de baixa emissão na rede Polygon.',
    creator: 'Nova Sato',
    royaltyPercent: 5,
    contractAddress: '0x9D21...77B4',
    attributes: ['Moletom Roxo', 'Cósmico', 'Polygon'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '2.99', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.69', available: 8, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.29', available: 12, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.59', available: 60, totalSupply: 100 },
    ],
    createdAt: '2026-07-25T18:00:00.000Z',
    version: 1,
  },
  {
    id: 'violet-nomad-314',
    tokenId: '#0314',
    title: 'Violet Nomad #314',
    collectionName: 'Kurio Nomads',
    category: 'Generativa',
    network: 'Ethereum',
    priceEth: '1.39',
    image: '/assets/nfts/ape-purple.png',
    gallery: ['/assets/nfts/ape-purple.png', '/assets/nfts/ape-emerald.png'],
    isFeatured: false,
    isNewRelease: false,
    isTrending: true,
    rating: 4.9,
    reviewsCount: 31,
    reviews: [],
    shortDescription:
      'Composição generativa de alta precisão com variações cromáticas violeta.',
    fullDescription:
      'Violet Nomad #314 foi gerada a partir de sementes algorítmicas curadas manualmente pelo estúdio Kurio.',
    creator: 'Kenji Takahashi',
    royaltyPercent: 5,
    contractAddress: '0x7A42...19E8',
    attributes: ['Violeta', 'Generativo', 'Nomad'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '3.10', available: 2, totalSupply: 2 },
      { edition: '1/10', priceEth: '1.79', available: 7, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.39', available: 15, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.69', available: 90, totalSupply: 150 },
    ],
    createdAt: '2026-07-24T12:00:00.000Z',
    version: 1,
  },
  {
    id: 'ivory-baron-088',
    tokenId: '#0088',
    title: 'Ivory Baron #088',
    collectionName: 'Kurio Vessels',
    category: 'Fotografia',
    network: 'Ethereum',
    priceEth: '1.79',
    image: '/assets/nfts/ape-ivory.png',
    gallery: ['/assets/nfts/ape-ivory.png', '/assets/nfts/ape-emerald.png'],
    isFeatured: false,
    isNewRelease: true,
    isTrending: false,
    rating: 4.8,
    reviewsCount: 16,
    reviews: [],
    shortDescription:
      'Retrato de estúdio com iluminação dramática e textura de alta definição.',
    fullDescription:
      'Ivory Baron #088 representa a fusão entre fotografia de retrato de estúdio e renderização hiper-realista.',
    creator: 'Elena Vance',
    royaltyPercent: 5,
    contractAddress: '0x3C90...88A2',
    attributes: ['Marfim', 'Gola Alta', 'Barão'],
    defaultEdition: '1/10',
    editions: [
      { edition: '1/1', priceEth: '4.50', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.79', available: 12, totalSupply: 15 },
      { edition: '1/50', priceEth: '1.19', available: 30, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.75', available: 50, totalSupply: 100 },
    ],
    createdAt: '2026-07-23T15:20:00.000Z',
    version: 1,
  },
  {
    id: 'golden-beat-207',
    tokenId: '#0207',
    title: 'Golden Beat #207',
    collectionName: 'Kurio Sound',
    category: 'Música',
    network: 'Solana',
    priceEth: '0.99',
    image: '/assets/nfts/ape-golden.png',
    gallery: ['/assets/nfts/ape-golden.png', '/assets/nfts/ape-emerald.png'],
    isFeatured: false,
    isNewRelease: true,
    isTrending: true,
    rating: 4.9,
    reviewsCount: 27,
    reviews: [],
    shortDescription:
      'Colecionável audiovisual com trilha sonora lo-fi exclusiva desbloqueável para detentores.',
    fullDescription:
      'Golden Beat #207 une arte visual vibrante com stems musicais masterizados registrados on-chain.',
    creator: 'DJ Kora',
    royaltyPercent: 7,
    contractAddress: '0x5F10...33C9',
    attributes: ['Headphones', 'Dourado', 'Áudio'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '2.49', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.39', available: 5, totalSupply: 10 },
      { edition: '1/50', priceEth: '0.99', available: 20, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.49', available: 120, totalSupply: 200 },
    ],
    createdAt: '2026-07-22T11:10:00.000Z',
    version: 1,
  },
  {
    id: 'golden-frequency-071',
    tokenId: '#0071',
    title: 'Golden Frequency #071',
    collectionName: 'Kurio Sound',
    category: 'Música',
    network: 'Polygon',
    priceEth: '0.59',
    image: '/assets/nfts/ape-golden.png',
    gallery: ['/assets/nfts/ape-golden.png', '/assets/nfts/ape-purple.png'],
    isFeatured: false,
    isNewRelease: false,
    isTrending: false,
    rating: 4.5,
    reviewsCount: 9,
    reviews: [],
    shortDescription:
      'Frequências analógicas transformadas em arte colecionável na rede Polygon.',
    fullDescription:
      'Golden Frequency #071 celebra a cultura dos sintetizadores clássicos com acesso a sessões ao vivo.',
    creator: 'DJ Kora',
    royaltyPercent: 5,
    contractAddress: '0x5F10...33C9',
    attributes: ['Frequência', 'Sintetizador', 'Verde'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '1.59', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '0.89', available: 6, totalSupply: 10 },
      { edition: '1/50', priceEth: '0.59', available: 25, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.29', available: 90, totalSupply: 100 },
    ],
    createdAt: '2026-07-21T08:45:00.000Z',
    version: 1,
  },
  {
    id: 'golden-signal-160',
    tokenId: '#0160',
    title: 'Golden Signal #160',
    collectionName: 'Kurio Sound',
    category: 'Utilidade',
    network: 'Solana',
    priceEth: '0.39',
    image: '/assets/nfts/ape-golden.png',
    gallery: ['/assets/nfts/ape-golden.png', '/assets/nfts/ape-ivory.png'],
    isFeatured: false,
    isNewRelease: false,
    isTrending: true,
    rating: 4.7,
    reviewsCount: 18,
    reviews: [],
    shortDescription:
      'Passe de utilidade e acesso antecipado aos próximos drops da Kurio.',
    fullDescription:
      'Golden Signal #160 garante whitelist prioritária e desconto em taxas nos lançamentos trimestrais.',
    creator: 'Kurio Labs',
    royaltyPercent: 5,
    contractAddress: '0x1A88...90D1',
    attributes: ['Passe', 'Whitelist', 'Sinal'],
    defaultEdition: 'ABERTA',
    editions: [
      { edition: '1/1', priceEth: '1.20', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '0.79', available: 9, totalSupply: 10 },
      { edition: '1/50', priceEth: '0.49', available: 35, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.39', available: 85, totalSupply: 100 },
    ],
    createdAt: '2026-07-20T16:00:00.000Z',
    version: 1,
  },
  {
    id: 'cyber-arena-404',
    tokenId: '#0404',
    title: 'Cyber Arena #404',
    collectionName: 'Kurio Gaming',
    category: 'Jogos',
    network: 'Polygon',
    priceEth: '0.85',
    image: '/assets/nfts/ape-emerald.png',
    gallery: ['/assets/nfts/ape-emerald.png', '/assets/nfts/ape-ivory.png'],
    isFeatured: false,
    isNewRelease: true,
    isTrending: false,
    rating: 4.6,
    reviewsCount: 12,
    reviews: [],
    shortDescription: 'Avatar jogável compatível com arenas interoperáveis Web3.',
    fullDescription:
      'Cyber Arena #404 equipa seu inventário com atributos de velocidade e skin esmeralda exclusiva.',
    creator: 'Kurio Gaming Studio',
    royaltyPercent: 5,
    contractAddress: '0x6E33...11B0',
    attributes: ['Gaming', 'Avatar', 'Velocidade'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '2.10', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.25', available: 4, totalSupply: 10 },
      { edition: '1/50', priceEth: '0.85', available: 19, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.45', available: 70, totalSupply: 100 },
    ],
    createdAt: '2026-07-19T13:00:00.000Z',
    version: 1,
  },
  {
    id: 'genesis-pass-001',
    tokenId: '#0001',
    title: 'Genesis Pass #001',
    collectionName: 'Kurio Membership',
    category: 'Assinaturas',
    network: 'Ethereum',
    priceEth: '2.45',
    badge: 'RARO',
    image: '/assets/nfts/ape-ivory.png',
    gallery: ['/assets/nfts/ape-ivory.png', '/assets/nfts/ape-emerald.png'],
    isFeatured: true,
    isNewRelease: false,
    isTrending: true,
    rating: 5.0,
    reviewsCount: 42,
    reviews: [],
    shortDescription: 'Assinatura vitalícia do clube de colecionadores Kurio Genesis.',
    fullDescription:
      'Genesis Pass #001 concede acesso ao conselho curador, airdrops sazonais e eventos presenciais.',
    creator: 'Kurio Labs',
    royaltyPercent: 5,
    contractAddress: '0x7A42...19E8',
    attributes: ['Genesis', 'VIP', 'Vitalício'],
    defaultEdition: '1/10',
    editions: [
      { edition: '1/1', priceEth: '5.50', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '2.45', available: 3, totalSupply: 10 },
      { edition: '1/50', priceEth: '1.75', available: 10, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '1.10', available: 30, totalSupply: 100 },
    ],
    createdAt: '2026-07-18T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'aurora-prism-777',
    tokenId: '#0777',
    title: 'Aurora Prism #777',
    collectionName: 'Kurio Editions',
    category: 'Arte 3D',
    network: 'Solana',
    priceEth: '0.68',
    image: '/assets/nfts/ape-purple.png',
    gallery: ['/assets/nfts/ape-purple.png', '/assets/nfts/ape-golden.png'],
    isFeatured: false,
    isNewRelease: true,
    isTrending: false,
    rating: 4.7,
    reviewsCount: 8,
    reviews: [],
    shortDescription: 'Escultura prismática 3D otimizada para exibição em frames digitais.',
    fullDescription:
      'Aurora Prism #777 reflete gradientes dinâmicos inspirados nas luzes boreais.',
    creator: 'Nova Sato',
    royaltyPercent: 5,
    contractAddress: '0x8B11...42F1',
    attributes: ['Prisma', 'Aurora', '3D'],
    defaultEdition: '1/50',
    editions: [
      { edition: '1/1', priceEth: '1.80', available: 1, totalSupply: 1 },
      { edition: '1/10', priceEth: '1.10', available: 7, totalSupply: 10 },
      { edition: '1/50', priceEth: '0.68', available: 28, totalSupply: 50 },
      { edition: 'ABERTA', priceEth: '0.35', available: 64, totalSupply: 100 },
    ],
    createdAt: '2026-07-17T09:00:00.000Z',
    version: 1,
  },
];

export function createInitialDbState(): MockDbState {
  const user1: StoredUser = {
    id: 'user-collector-1',
    username: 'novasato',
    displayName: 'Nova Sato',
    email: 'contato@email.com',
    ensName: 'nova.kurio',
    ensDomain: '.eth',
    walletNickname: 'Principal',
    avatarUrl: '/assets/nfts/ape-emerald.png',
    createdAt: '2026-01-10T10:00:00.000Z',
    passwordHash: hashPassword('kurio123'),
  };

  const user2: StoredUser = {
    id: 'user-collector-2',
    username: 'kaicollector',
    displayName: 'Kai Collector',
    email: 'kai@kurio.art',
    ensName: 'kai.vault',
    ensDomain: '.eth',
    walletNickname: 'Vault Kai',
    avatarUrl: '/assets/nfts/ape-golden.png',
    createdAt: '2026-02-15T12:00:00.000Z',
    passwordHash: hashPassword('kurio123'),
  };

  const walletsUser1: WalletItem[] = [
    {
      id: 'wallet-primary-1',
      userId: user1.id,
      kind: 'primary',
      displayName: 'Nova Sato',
      nickname: 'Principal',
      network: 'Ethereum',
      profileName: 'Nova Collector',
      address: '0xA91F234567890ABCDE1234567890ABCDEF12E82C',
      secondaryEnsOrAddress: 'nova.kurio.eth',
      provider: 'MetaMask',
      referralCode: 'KURIO2026',
      email: 'contato@email.com',
      ensName: 'nova.kurio',
      ensDomain: '.eth',
      isConnected: true,
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
    {
      id: 'wallet-secondary-1',
      userId: user1.id,
      kind: 'secondary',
      displayName: 'Nova Sato',
      nickname: 'Reserva',
      network: 'Polygon',
      profileName: 'Nova Polygon',
      address: '0xB82E9876543210FEDCBA9876543210FEDCBA991A',
      secondaryEnsOrAddress: 'reserva.kurio.eth',
      provider: 'Coinbase Wallet',
      referralCode: 'KURIO2026',
      email: 'contato@email.com',
      ensName: 'nova.kurio',
      ensDomain: '.eth',
      isConnected: false,
      updatedAt: '2026-07-02T10:00:00.000Z',
    },
  ];

  const walletsUser2: WalletItem[] = [
    {
      id: 'wallet-primary-2',
      userId: user2.id,
      kind: 'primary',
      displayName: 'Kai Collector',
      nickname: 'Vault Principal',
      network: 'Ethereum',
      profileName: 'Kai Web3',
      address: '0xC77D11223344556677889900AABBCCDDEEFF0011',
      secondaryEnsOrAddress: 'kai.vault.eth',
      provider: 'WalletConnect',
      referralCode: 'KAI777',
      email: 'kai@kurio.art',
      ensName: 'kai.vault',
      ensDomain: '.eth',
      isConnected: true,
      updatedAt: '2026-07-05T10:00:00.000Z',
    },
  ];

  const coupons: CouponRecord[] = [
    {
      code: 'KURIO10',
      discountPercent: 10,
      expiresAt: '2027-12-31T23:59:59.000Z',
      description: '10% de desconto de lançamento',
    },
    {
      code: 'GREEN20',
      discountPercent: 20,
      expiresAt: '2027-12-31T23:59:59.000Z',
      description: '20% de desconto VIP Kurio',
    },
    {
      code: 'EXPIRADO50',
      discountPercent: 50,
      expiresAt: '2024-01-01T00:00:00.000Z',
      description: 'Cupom promocional expirado',
    },
  ];

  return {
    users: [user1, user2],
    sessions: {},
    nfts: structuredClone(BASE_NFTS),
    favoritesByUser: {
      [user1.id]: ['emerald-ape-042'],
      [user2.id]: ['golden-beat-207'],
    },
    cartsByOwner: {
      guest: { items: [], couponCode: null },
      [user1.id]: { items: [], couponCode: null },
      [user2.id]: { items: [], couponCode: null },
    },
    walletsByUser: {
      [user1.id]: walletsUser1,
      [user2.id]: walletsUser2,
    },
    orders: [],
    coupons,
    sim: { ...DEFAULT_SIM },
    eventCounter: 100,
  };
}

let memoryState: MockDbState | null = null;

export function getDb(): MockDbState {
  if (memoryState) return memoryState;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDbState;
        if (parsed && Array.isArray(parsed.nfts) && Array.isArray(parsed.users)) {
          memoryState = parsed;
          return memoryState;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }
  memoryState = createInitialDbState();
  saveDb(memoryState);
  return memoryState;
}

export function saveDb(state: MockDbState = getDb()): void {
  memoryState = state;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function resetDb(seedCartWithFigmaItems = false): MockDbState {
  const fresh = createInitialDbState();
  if (seedCartWithFigmaItems) {
    const seededCart = {
      couponCode: null,
      items: [
        buildCartItemFromNft(fresh.nfts[0], '1/50', 2), // Emerald Ape #042 x 2 = 2.38 ETH
        buildCartItemFromNft(fresh.nfts[4], '1/50', 6), // Violet Nomad #314 x 6 = 8.34 ETH
        buildCartItemFromNft(fresh.nfts[5], '1/10', 9), // Ivory Baron #088 x 9 = 16.11 ETH
      ],
    };
    fresh.cartsByOwner['guest'] = structuredClone(seededCart);
    for (const u of fresh.users) {
      fresh.cartsByOwner[u.id] = structuredClone(seededCart);
    }
  }
  saveDb(fresh);
  return fresh;
}

export function buildCartItemFromNft(
  nft: NftItem,
  edition: EditionType,
  quantity: number
): CartItem {
  const ed = nft.editions.find((e) => e.edition === edition) || nft.editions[0];
  return {
    id: `${nft.id}:${ed.edition}`,
    nftId: nft.id,
    tokenId: nft.tokenId,
    title: nft.title,
    image: nft.image,
    edition: ed.edition,
    quantity,
    unitPriceEth: ed.priceEth,
    available: ed.available,
    lineTotalEth: mulEth(ed.priceEth, quantity),
    nftVersion: nft.version,
  };
}

export function computeNetworkFeeEth(network: NetworkType = 'Ethereum', itemCount: number): string {
  if (itemCount <= 0) return '0.00';
  if (network === 'Polygon') return '0.004';
  if (network === 'Solana') return '0.002';
  return '0.016'; // Matches Figma exact network fee: 0.016 ETH!
}

export function computeQuoteFromOwnerCart(
  db: MockDbState,
  ownerKey: string,
  network: NetworkType = 'Ethereum'
) {
  const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
  const syncedItems: CartItem[] = [];

  for (const item of rawCart.items) {
    const nft = db.nfts.find((n) => n.id === item.nftId);
    if (!nft) continue;
    const ed = nft.editions.find((e) => e.edition === item.edition) || nft.editions[0];
    const priceChanged = item.unitPriceEth !== ed.priceEth;
    const stockChanged = ed.available < item.quantity;
    syncedItems.push({
      ...item,
      unitPriceEth: ed.priceEth,
      available: ed.available,
      lineTotalEth: mulEth(ed.priceEth, item.quantity),
      nftVersion: nft.version,
      priceChanged: priceChanged || item.priceChanged,
      previousPriceEth: priceChanged ? item.unitPriceEth : item.previousPriceEth,
      stockChanged,
    });
  }

  rawCart.items = syncedItems;
  db.cartsByOwner[ownerKey] = rawCart;

  const subtotalEth =
    syncedItems.length > 0
      ? addEth(...syncedItems.map((i) => i.lineTotalEth))
      : '0.00';

  let discountPercent = 0;
  if (rawCart.couponCode) {
    const coupon = db.coupons.find(
      (c) => c.code.toUpperCase() === rawCart.couponCode?.toUpperCase()
    );
    if (coupon && new Date(coupon.expiresAt).getTime() > Date.now()) {
      discountPercent = coupon.discountPercent;
    }
  }

  const discountEth =
    discountPercent > 0 ? percentOfEth(subtotalEth, discountPercent) : '0.00';
  const afterDiscount = subEth(subtotalEth, discountEth);
  const networkFeeEth = computeNetworkFeeEth(network, syncedItems.length);
  const totalEth = syncedItems.length > 0 ? addEth(afterDiscount, networkFeeEth) : '0.00';

  const quoteSignature = syncedItems
    .map((i) => `${i.nftId}:${i.edition}:${i.quantity}:${i.unitPriceEth}:${i.available}`)
    .join('|');
  const quoteHash = `q_${simpleHash(`${quoteSignature}|${rawCart.couponCode || ''}|${totalEth}`)}`;

  return {
    items: syncedItems,
    couponCode: rawCart.couponCode,
    discountPercent,
    subtotalEth: formatEthPrecise(subtotalEth),
    discountEth: formatEthPrecise(discountEth),
    networkFeeEth,
    totalEth: formatEthPrecise(totalEth),
    quoteHash,
    updatedAt: new Date().toISOString(),
  };
}
