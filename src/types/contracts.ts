import { z } from 'zod';

// ==========================================
// 1. Enums & Shared Primitives
// ==========================================

export const NetworkSchema = z.enum(['Ethereum', 'Polygon', 'Solana']);
export type NetworkType = z.infer<typeof NetworkSchema>;

export const CollectionCategorySchema = z.enum([
  'Arte digital',
  'Fotografia',
  'Música',
  'Arte 3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
]);
export type CollectionCategory = z.infer<typeof CollectionCategorySchema>;

export const EditionTypeSchema = z.enum(['1/1', '1/10', '1/50', 'ABERTA']);
export type EditionType = z.infer<typeof EditionTypeSchema>;

export const WalletProviderSchema = z.enum([
  'MetaMask',
  'Coinbase Wallet',
  'WalletConnect',
]);
export type WalletProvider = z.infer<typeof WalletProviderSchema>;

export const SortOptionSchema = z.enum([
  'recent',
  'price_asc',
  'price_desc',
  'popular',
]);
export type SortOption = z.infer<typeof SortOptionSchema>;

export const TabFilterSchema = z.enum(['all', 'new', 'trending']);
export type TabFilter = z.infer<typeof TabFilterSchema>;

// ==========================================
// 2. NFT & Catalog Contracts
// ==========================================

export const NftEditionInfoSchema = z.object({
  edition: EditionTypeSchema,
  priceEth: z.string(), // Decimal ETH string e.g. "1.19"
  originalPriceEth: z.string().optional(),
  available: z.number().int().nonnegative(),
  totalSupply: z.number().int().positive(),
});
export type NftEditionInfo = z.infer<typeof NftEditionInfoSchema>;

export const NftReviewSchema = z.object({
  id: z.string(),
  author: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  date: z.string(),
});
export type NftReview = z.infer<typeof NftReviewSchema>;

export const NftItemSchema = z.object({
  id: z.string(),
  tokenId: z.string(), // e.g. "#0042"
  title: z.string(), // e.g. "Emerald Ape #042"
  collectionName: z.string(), // e.g. "Kurio Apes"
  category: CollectionCategorySchema,
  network: NetworkSchema,
  priceEth: z.string(), // Default edition price as decimal string
  originalPriceEth: z.string().optional(),
  image: z.string(),
  gallery: z.array(z.string()),
  badge: z.string().optional(), // e.g. "RARO", "OFERTA LIMITADA"
  isFeatured: z.boolean().default(false),
  isNewRelease: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  rating: z.number().default(4.8),
  reviewsCount: z.number().int().default(19),
  reviews: z.array(NftReviewSchema).default([]),
  shortDescription: z.string(),
  fullDescription: z.string(),
  creator: z.string(),
  royaltyPercent: z.number(),
  contractAddress: z.string(),
  attributes: z.array(z.string()),
  editions: z.array(NftEditionInfoSchema),
  defaultEdition: EditionTypeSchema,
  createdAt: z.string(),
  version: z.number().int().positive(),
});
export type NftItem = z.infer<typeof NftItemSchema>;

export const NftListParamsSchema = z.object({
  q: z.string().optional(),
  categories: z.array(CollectionCategorySchema).optional(),
  networks: z.array(NetworkSchema).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  tab: TabFilterSchema.optional(),
  sort: SortOptionSchema.optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
export type NftListParams = z.infer<typeof NftListParamsSchema>;

export const NftListResponseSchema = z.object({
  items: z.array(NftItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  facets: z.object({
    categories: z.record(z.string(), z.number()),
    networks: z.record(z.string(), z.number()),
  }),
});
export type NftListResponse = z.infer<typeof NftListResponseSchema>;

// ==========================================
// 3. Auth, Session, Profile & Wallets
// ==========================================

export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string().min(2, 'Informe pelo menos 2 caracteres'),
  displayName: z.string().min(2, 'Informe o nome de exibição'),
  email: z.string().email('Informe um e-mail válido'),
  ensName: z.string().min(2, 'Informe o nome ENS'),
  ensDomain: z.enum(['.eth', '.kurio.eth', '.xyz']).default('.eth'),
  walletNickname: z.string().min(2, 'Informe o apelido da carteira'),
  avatarUrl: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const SessionResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
  user: UserProfileSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email('Digite um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z
  .object({
    username: z.string().min(3, 'O nome de usuário deve ter pelo menos 3 caracteres'),
    email: z.string().email('Digite um e-mail válido'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const UpdateProfileInputSchema = z.object({
  displayName: z.string().min(2, 'Nome de exibição é obrigatório'),
  username: z.string().min(3, 'Nome de usuário deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  ensName: z.string().min(2, 'Nome ENS é obrigatório'),
  ensDomain: z.enum(['.eth', '.kurio.eth', '.xyz']),
  walletNickname: z.string().min(2, 'Apelido da carteira é obrigatório'),
  avatarUrl: z.string().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const ChangePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(6, 'Informe sua senha atual'),
    newPassword: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres'),
    confirmNewPassword: z.string().min(6, 'Confirme a nova senha'),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'A confirmação da nova senha não confere',
    path: ['confirmNewPassword'],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const WalletItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kind: z.enum(['primary', 'secondary']),
  displayName: z.string().min(2, 'Nome de exibição obrigatório'),
  nickname: z.string().min(2, 'Apelido da carteira obrigatório'),
  network: NetworkSchema,
  profileName: z.string().min(2, 'Nome do perfil obrigatório'),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{4,40}$|^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/, 'Endereço 0x inválido'),
  secondaryEnsOrAddress: z.string().optional().default(''),
  provider: WalletProviderSchema,
  referralCode: z.string().min(2, 'Código de indicação obrigatório'),
  email: z.string().email('E-mail inválido'),
  ensName: z.string().min(2, 'Nome ENS obrigatório'),
  ensDomain: z.enum(['.eth', '.kurio.eth', '.xyz']).default('.eth'),
  isConnected: z.boolean().default(true),
  updatedAt: z.string(),
});
export type WalletItem = z.infer<typeof WalletItemSchema>;

export const UpsertWalletInputSchema = WalletItemSchema.omit({
  id: true,
  userId: true,
  updatedAt: true,
});
export type UpsertWalletInput = z.infer<typeof UpsertWalletInputSchema>;

// ==========================================
// 4. Cart & Quote Contracts
// ==========================================

export const CartItemSchema = z.object({
  id: z.string(), // `${nftId}:${edition}`
  nftId: z.string(),
  tokenId: z.string(),
  title: z.string(),
  image: z.string(),
  edition: EditionTypeSchema,
  quantity: z.number().int().positive(),
  unitPriceEth: z.string(),
  available: z.number().int().nonnegative(),
  lineTotalEth: z.string(),
  nftVersion: z.number().int().positive(),
  priceChanged: z.boolean().optional(),
  previousPriceEth: z.string().optional(),
  stockChanged: z.boolean().optional(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartStateSchema = z.object({
  items: z.array(CartItemSchema),
  couponCode: z.string().nullable(),
  discountPercent: z.number().nonnegative(),
  subtotalEth: z.string(),
  discountEth: z.string(),
  networkFeeEth: z.string(),
  totalEth: z.string(),
  quoteHash: z.string(),
  updatedAt: z.string(),
});
export type CartState = z.infer<typeof CartStateSchema>;

export const QuoteRequestSchema = z.object({
  items: z.array(
    z.object({
      nftId: z.string(),
      edition: EditionTypeSchema,
      quantity: z.number().int().positive(),
      expectedUnitPriceEth: z.string().optional(),
    })
  ),
  couponCode: z.string().nullable().optional(),
  network: NetworkSchema.optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const QuoteIssueSchema = z.object({
  type: z.enum(['PRICE_CHANGED', 'INSUFFICIENT_STOCK', 'EDITION_UNAVAILABLE', 'COUPON_INVALID', 'COUPON_EXPIRED']),
  nftId: z.string().optional(),
  edition: EditionTypeSchema.optional(),
  message: z.string(),
  previousPriceEth: z.string().optional(),
  currentPriceEth: z.string().optional(),
  availableStock: z.number().int().nonnegative().optional(),
});
export type QuoteIssue = z.infer<typeof QuoteIssueSchema>;

export const QuoteResponseSchema = z.object({
  valid: z.boolean(),
  quoteHash: z.string(),
  items: z.array(CartItemSchema),
  couponCode: z.string().nullable(),
  discountPercent: z.number(),
  subtotalEth: z.string(),
  discountEth: z.string(),
  networkFeeEth: z.string(),
  totalEth: z.string(),
  issues: z.array(QuoteIssueSchema),
  calculatedAt: z.string(),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

// ==========================================
// 5. Orders & Checkout Contracts
// ==========================================

export const CollectorCheckoutDetailsSchema = z.object({
  displayName: z.string().min(2, 'Informe o nome de exibição'),
  username: z.string().min(2, 'Informe o nome de usuário'),
  network: NetworkSchema,
  profileName: z.string().min(2, 'Informe o nome do perfil'),
  walletAddress: z
    .string()
    .min(6, 'Informe um endereço 0x válido')
    .regex(/^0x[a-fA-F0-9]{4,40}$|^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/, 'Formato 0x inválido'),
  secondaryWalletOrEns: z.string().optional().default(''),
  walletProvider: WalletProviderSchema,
  referralCode: z.string().min(2, 'Informe o código de indicação'),
  email: z.string().email('Informe um e-mail válido'),
  ensName: z.string().min(2, 'Informe o nome ENS'),
  ensDomain: z.enum(['.eth', '.kurio.eth', '.xyz']).default('.eth'),
  useAnotherWallet: z.boolean().default(false),
  notes: z.string().optional().default(''),
  selectedWalletId: z.string().optional(),
});
export type CollectorCheckoutDetails = z.infer<typeof CollectorCheckoutDetailsSchema>;

export const CreateOrderInputSchema = z.object({
  idempotencyKey: z.string().min(8),
  quoteHash: z.string().min(4),
  items: z.array(
    z.object({
      nftId: z.string(),
      edition: EditionTypeSchema,
      quantity: z.number().int().positive(),
      unitPriceEth: z.string(),
    })
  ),
  couponCode: z.string().nullable().optional(),
  collector: CollectorCheckoutDetailsSchema,
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const OrderStatusSchema = z.enum(['pending', 'confirmed', 'declined']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSnapshotSchema = z.object({
  nftId: z.string(),
  tokenId: z.string(),
  title: z.string(),
  image: z.string(),
  edition: EditionTypeSchema,
  quantity: z.number().int().positive(),
  unitPriceEth: z.string(),
  subtotalEth: z.string(),
});
export type OrderItemSnapshot = z.infer<typeof OrderItemSnapshotSchema>;

export const OrderReceiptSchema = z.object({
  id: z.string(),
  userId: z.string(),
  idempotencyKey: z.string(),
  requestFingerprint: z.string(),
  status: OrderStatusSchema,
  txHash: z.string(),
  explorerUrl: z.string(),
  network: NetworkSchema,
  walletProvider: WalletProviderSchema,
  walletAddress: z.string(),
  collector: CollectorCheckoutDetailsSchema,
  items: z.array(OrderItemSnapshotSchema),
  couponCode: z.string().nullable(),
  subtotalEth: z.string(),
  discountEth: z.string(),
  networkFeeEth: z.string(),
  totalEth: z.string(),
  failureReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
});
export type OrderReceipt = z.infer<typeof OrderReceiptSchema>;

// ==========================================
// 6. Real-Time Socket.IO Event Contracts
// ==========================================

export const NftUpdatedEventSchema = z.object({
  eventId: z.string(),
  resourceId: z.string(), // nftId
  version: z.number().int().positive(),
  timestamp: z.string(),
  payload: z.object({
    nftId: z.string(),
    edition: EditionTypeSchema,
    priceEth: z.string(),
    available: z.number().int().nonnegative(),
    nft: NftItemSchema,
  }),
});
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEventSchema>;

export const OrderUpdatedEventSchema = z.object({
  eventId: z.string(),
  resourceId: z.string(), // orderId
  userId: z.string(),
  version: z.number().int().positive(),
  timestamp: z.string(),
  payload: z.object({
    order: OrderReceiptSchema,
  }),
});
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEventSchema>;

// ==========================================
// 7. API Error Contract
// ==========================================

export const ApiErrorPayloadSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'SESSION_EXPIRED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'QUOTE_OUTDATED',
    'IDEMPOTENCY_CONFLICT',
    'PAYMENT_DECLINED',
    'WALLET_REJECTED',
    'NETWORK_TIMEOUT',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  details: z.any().optional(),
});
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;
