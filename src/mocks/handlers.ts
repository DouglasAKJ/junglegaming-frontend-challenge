import { http, HttpResponse, delay } from 'msw';
import {
  getDb,
  saveDb,
  resetDb,
  verifyPassword,
  hashPassword,
  buildCartItemFromNft,
  computeQuoteFromOwnerCart,
  computeNetworkFeeEth,
  SimulationConfig,
} from './db';
import {
  broadcastNftUpdated,
  broadcastOrderUpdated,
  disconnectAllMockSockets,
} from './ws';
import {
  EditionType,
  NetworkType,
  OrderReceipt,
  QuoteIssue,
  QuoteRequest,
  CreateOrderInput,
  UpdateProfileInput,
  ChangePasswordInput,
  UpsertWalletInput,
  NftUpdatedEvent,
  OrderUpdatedEvent,
} from '@/types/contracts';
import { addEth, mulEth, percentOfEth, subEth, formatEthPrecise, compareEth } from '@/lib/eth';

async function applyNetworkSimulation(request: Request, isCatalogQuery = false) {
  const db = getDb();
  const sim = db.sim;

  const shouldFail = sim.failNextRequest;
  if (shouldFail) {
    sim.failNextRequest = false;
    saveDb(db);
  }
  const forcedHttpError = sim.forceHttpError;

  const baseDelay = Math.max(0, sim.latencyMs + Math.floor(Math.random() * (sim.jitterMs + 1)));

  // Out-of-order catalog simulation: if query has a shorter search string, delay it longer so a subsequent query can win
  if (isCatalogQuery && sim.outOfOrderCatalog) {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    if (q.length === 1) {
      await delay(900);
    } else {
      await delay(80);
    }
  } else if (baseDelay > 0) {
    await delay(baseDelay);
  }

  if (shouldFail) {
    return HttpResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Falha transitória de conexão com o servidor. Tente novamente.',
      },
      { status: 503 }
    );
  }

  if (forcedHttpError) {
    const status = forcedHttpError;
    return HttpResponse.json(
      {
        code: status === 401 ? 'SESSION_EXPIRED' : 'INTERNAL_ERROR',
        message:
          status === 401
            ? 'Sua sessão expirou. Faça login novamente para continuar.'
            : `Erro simulado HTTP ${status}.`,
      },
      { status }
    );
  }

  return null;
}

function getAuthenticatedUser(request: Request) {
  const db = getDb();
  if (db.sim.forceSessionExpired) {
    return { error: 'SESSION_EXPIRED' as const, user: null, token: null };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { error: 'UNAUTHORIZED' as const, user: null, token: null };
  }

  const session = db.sessions[token];
  if (!session) {
    return { error: 'UNAUTHORIZED' as const, user: null, token: null };
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    delete db.sessions[token];
    saveDb(db);
    return { error: 'SESSION_EXPIRED' as const, user: null, token: null };
  }

  const user = db.users.find((u) => u.id === session.userId) || null;
  if (!user) {
    return { error: 'UNAUTHORIZED' as const, user: null, token: null };
  }

  return { error: null, user, token };
}

function getCartOwnerKey(request: Request): string {
  const { user } = getAuthenticatedUser(request);
  return user ? user.id : 'guest';
}

export function updateNftPriceOrStockAndBroadcast(params: {
  nftId: string;
  edition?: EditionType;
  priceEth?: string;
  available?: number;
  forceVersion?: number;
  forceEventId?: string;
}): NftUpdatedEvent | null {
  const db = getDb();
  const nft = db.nfts.find((n) => n.id === params.nftId);
  if (!nft) return null;

  const targetEdition = params.edition || nft.defaultEdition;
  const ed = nft.editions.find((e) => e.edition === targetEdition) || nft.editions[0];

  if (params.priceEth !== undefined) {
    ed.priceEth = formatEthPrecise(params.priceEth);
    if (ed.edition === nft.defaultEdition) {
      nft.priceEth = ed.priceEth;
    }
  }

  if (params.available !== undefined) {
    ed.available = Math.max(0, Math.floor(params.available));
  }

  nft.version = params.forceVersion !== undefined ? params.forceVersion : nft.version + 1;
  db.eventCounter += 1;

  // Mark cart items across all owners if price or stock changed
  for (const cart of Object.values(db.cartsByOwner)) {
    for (const item of cart.items) {
      if (item.nftId === nft.id && item.edition === ed.edition) {
        if (item.unitPriceEth !== ed.priceEth) {
          item.previousPriceEth = item.unitPriceEth;
          item.unitPriceEth = ed.priceEth;
          item.lineTotalEth = mulEth(ed.priceEth, item.quantity);
          item.priceChanged = true;
        }
        if (ed.available < item.quantity) {
          item.stockChanged = true;
        }
        item.available = ed.available;
        item.nftVersion = nft.version;
      }
    }
  }

  saveDb(db);

  const event: NftUpdatedEvent = {
    eventId: params.forceEventId || `evt_nft_${db.eventCounter}_${nft.version}`,
    resourceId: nft.id,
    version: nft.version,
    timestamp: new Date().toISOString(),
    payload: {
      nftId: nft.id,
      edition: ed.edition,
      priceEth: ed.priceEth,
      available: ed.available,
      nft: structuredClone(nft),
    },
  };

  broadcastNftUpdated(event);
  return event;
}

export function transitionOrderStatusAndBroadcast(
  orderId: string,
  status: 'confirmed' | 'declined',
  failureReason?: string,
  forceVersion?: number,
  forceEventId?: string
): OrderUpdatedEvent | null {
  const db = getDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;

  // Terminal orders do not regress unless forced in a duplicate/stale event test
  if (forceVersion === undefined && (order.status === 'confirmed' || order.status === 'declined')) {
    return null;
  }

  if (forceVersion === undefined) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.version += 1;
    if (failureReason) {
      order.failureReason = failureReason;
    }

    if (status === 'confirmed') {
      // Deduct stock and remove ONLY the purchased items & quantities from user's cart
      for (const purchased of order.items) {
        const nft = db.nfts.find((n) => n.id === purchased.nftId);
        if (nft) {
          const ed = nft.editions.find((e) => e.edition === purchased.edition);
          if (ed) {
            ed.available = Math.max(0, ed.available - purchased.quantity);
          }
          nft.version += 1;
        }
      }

      const userCart = db.cartsByOwner[order.userId];
      if (userCart) {
        const remaining: typeof userCart.items = [];
        for (const cartItem of userCart.items) {
          const bought = order.items.find(
            (i) => i.nftId === cartItem.nftId && i.edition === cartItem.edition
          );
          if (!bought) {
            remaining.push(cartItem);
          } else if (cartItem.quantity > bought.quantity) {
            const diff = cartItem.quantity - bought.quantity;
            remaining.push({
              ...cartItem,
              quantity: diff,
              lineTotalEth: mulEth(cartItem.unitPriceEth, diff),
            });
          }
        }
        userCart.items = remaining;
        if (remaining.length === 0) {
          userCart.couponCode = null;
        }
      }
    }
  }

  db.eventCounter += 1;
  saveDb(db);

  const eventVersion = forceVersion !== undefined ? forceVersion : order.version;
  const snapshotOrder: OrderReceipt =
    forceVersion !== undefined
      ? { ...structuredClone(order), status, version: forceVersion, failureReason }
      : structuredClone(order);

  const event: OrderUpdatedEvent = {
    eventId: paramsEventId(forceEventId, db.eventCounter, eventVersion),
    resourceId: order.id,
    userId: order.userId,
    version: eventVersion,
    timestamp: new Date().toISOString(),
    payload: {
      order: snapshotOrder,
    },
  };

  broadcastOrderUpdated(event);
  return event;
}

function paramsEventId(customId: string | undefined, counter: number, version: number) {
  return customId || `evt_order_${counter}_${version}`;
}

export const httpHandlers = [
  // ==========================================
  // 1. Auth & Session
  // ==========================================
  http.post('/api/auth/login', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Preencha e-mail e senha.',
          fieldErrors: {
            email: !email ? 'E-mail obrigatório' : '',
            password: !password ? 'Senha obrigatória' : '',
          },
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return HttpResponse.json(
        {
          code: 'UNAUTHORIZED',
          message: 'Credenciais inválidas. Verifique seu e-mail e senha.',
        },
        { status: 401 }
      );
    }

    // Merge guest cart into user cart on login
    const guestCart = db.cartsByOwner['guest'];
    const userCart = db.cartsByOwner[user.id] || { items: [], couponCode: null };
    if (guestCart && guestCart.items.length > 0) {
      for (const gItem of guestCart.items) {
        const existing = userCart.items.find(
          (uItem) => uItem.nftId === gItem.nftId && uItem.edition === gItem.edition
        );
        if (existing) {
          existing.quantity = Math.min(existing.available, existing.quantity + gItem.quantity);
          existing.lineTotalEth = mulEth(existing.unitPriceEth, existing.quantity);
        } else {
          userCart.items.push({ ...gItem });
        }
      }
      if (!userCart.couponCode && guestCart.couponCode) {
        userCart.couponCode = guestCart.couponCode;
      }
      db.cartsByOwner[user.id] = userCart;
      db.cartsByOwner['guest'] = { items: [], couponCode: null };
    }

    const token = `tok_${user.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    db.sessions[token] = { userId: user.id, expiresAt };
    db.sim.forceSessionExpired = false;
    saveDb(db);

    const { passwordHash: _omitted, ...safeUser } = user;
    return HttpResponse.json({
      token,
      expiresAt,
      user: safeUser,
    });
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const username = (body.username || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    const fieldErrors: Record<string, string> = {};
    if (username.length < 3) fieldErrors.username = 'O nome de usuário deve ter pelo menos 3 caracteres';
    if (!email.includes('@')) fieldErrors.email = 'Digite um e-mail válido';
    if (password.length < 6) fieldErrors.password = 'A senha deve ter pelo menos 6 caracteres';
    if (body.confirmPassword !== undefined && body.confirmPassword !== password) {
      fieldErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos destacados.',
          fieldErrors,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const conflictEmail = db.users.find((u) => u.email.toLowerCase() === email);
    if (conflictEmail) {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: 'Este endereço de e-mail já está cadastrado.',
          fieldErrors: { email: 'E-mail já cadastrado na Kurio' },
        },
        { status: 409 }
      );
    }

    const conflictUsername = db.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (conflictUsername) {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: 'Este nome de usuário já está em uso.',
          fieldErrors: { username: 'Nome de usuário indisponível' },
        },
        { status: 409 }
      );
    }

    const newUser = {
      id: `user-${Date.now()}`,
      username,
      displayName: username,
      email,
      ensName: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ensDomain: '.eth' as const,
      walletNickname: 'Principal',
      avatarUrl: '/assets/nfts/ape-emerald.png',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };

    db.users.push(newUser);
    db.favoritesByUser[newUser.id] = [];

    // Transfer guest cart to new user
    const guestCart = db.cartsByOwner['guest'] || { items: [], couponCode: null };
    db.cartsByOwner[newUser.id] = structuredClone(guestCart);
    db.cartsByOwner['guest'] = { items: [], couponCode: null };

    // Create default primary wallet for convenience
    db.walletsByUser[newUser.id] = [
      {
        id: `wallet-primary-${newUser.id}`,
        userId: newUser.id,
        kind: 'primary',
        displayName: newUser.displayName,
        nickname: 'Principal',
        network: 'Ethereum',
        profileName: newUser.displayName,
        address: '0xA91F234567890ABCDE1234567890ABCDEF12E82C',
        secondaryEnsOrAddress: `${newUser.ensName}.eth`,
        provider: 'MetaMask',
        referralCode: 'KURIO2026',
        email: newUser.email,
        ensName: newUser.ensName,
        ensDomain: '.eth',
        isConnected: true,
        updatedAt: new Date().toISOString(),
      },
    ];

    const token = `tok_${newUser.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    db.sessions[token] = { userId: newUser.id, expiresAt };
    db.sim.forceSessionExpired = false;
    saveDb(db);

    const { passwordHash: _omitted, ...safeUser } = newUser;
    return HttpResponse.json(
      {
        token,
        expiresAt,
        user: safeUser,
      },
      { status: 201 }
    );
  }),

  http.get('/api/auth/session', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user, token } = getAuthenticatedUser(request);
    if (error || !user || !token) {
      return HttpResponse.json(
        {
          code: error || 'UNAUTHORIZED',
          message:
            error === 'SESSION_EXPIRED'
              ? 'Sua sessão expirou. Entre novamente para continuar.'
              : 'Sessão não autenticada.',
        },
        { status: 401 }
      );
    }

    const db = getDb();
    const session = db.sessions[token];
    const { passwordHash: _omitted, ...safeUser } = user;
    return HttpResponse.json({
      token,
      expiresAt: session.expiresAt,
      user: safeUser,
    });
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const db = getDb();
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      saveDb(db);
    }
    return HttpResponse.json({ ok: true });
  }),

  // ==========================================
  // 2. NFTs Catalog & Detail
  // ==========================================
  http.get('/api/nfts', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request, true);
    if (simResp) return simResp;

    const db = getDb();
    const url = new URL(request.url);

    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const categoriesParam = url.searchParams.get('categories');
    const categories = categoriesParam
      ? categoriesParam.split(',').filter(Boolean)
      : [];
    const networksParam = url.searchParams.get('networks');
    const networks = networksParam ? networksParam.split(',').filter(Boolean) : [];
    const minPrice = url.searchParams.get('minPrice') || '';
    const maxPrice = url.searchParams.get('maxPrice') || '';
    const tab = url.searchParams.get('tab') || 'all';
    const sort = url.searchParams.get('sort') || 'recent';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '9', 10));

    // Calculate facets across all NFTs
    const categoryFacets: Record<string, number> = {
      'Arte digital': 33,
      Fotografia: 12,
      Música: 65,
      'Arte 3D': 39,
      Colecionáveis: 23,
      Generativa: 17,
      Jogos: 19,
      Assinaturas: 13,
      Utilidade: 18,
    };
    const networkFacets: Record<string, number> = {
      Ethereum: 119,
      Polygon: 78,
      Solana: 86,
    };

    let filtered = [...db.nfts];

    if (q) {
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.collectionName.toLowerCase().includes(q) ||
          n.tokenId.toLowerCase().includes(q) ||
          n.creator.toLowerCase().includes(q) ||
          n.attributes.some((a) => a.toLowerCase().includes(q))
      );
    }

    if (categories.length > 0) {
      filtered = filtered.filter((n) => categories.includes(n.category));
    }

    if (networks.length > 0) {
      filtered = filtered.filter((n) => networks.includes(n.network));
    }

    if (minPrice && /^\d+(\.\d+)?$/.test(minPrice)) {
      filtered = filtered.filter((n) => compareEth(n.priceEth, minPrice) >= 0);
    }

    if (maxPrice && /^\d+(\.\d+)?$/.test(maxPrice)) {
      filtered = filtered.filter((n) => compareEth(n.priceEth, maxPrice) <= 0);
    }

    if (tab === 'new') {
      filtered = filtered.filter((n) => n.isNewRelease);
    } else if (tab === 'trending') {
      filtered = filtered.filter((n) => n.isTrending);
    }

    if (sort === 'price_asc') {
      filtered.sort((a, b) => compareEth(a.priceEth, b.priceEth));
    } else if (sort === 'price_desc') {
      filtered.sort((a, b) => compareEth(b.priceEth, a.priceEth));
    } else if (sort === 'popular') {
      filtered.sort((a, b) => b.reviewsCount - a.reviewsCount);
    } else {
      filtered.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    return HttpResponse.json({
      items,
      total,
      page,
      limit,
      totalPages,
      facets: {
        categories: categoryFacets,
        networks: networkFacets,
      },
    });
  }),

  http.get('/api/nfts/:id', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const db = getDb();
    const id = String(params.id);
    const nft = db.nfts.find((n) => n.id === id);

    if (!nft) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `O NFT "${id}" não foi encontrado na coleção Kurio.`,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json(nft);
  }),

  // ==========================================
  // 3. Favorites (Requires Auth)
  // ==========================================
  http.get('/api/favorites', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Autenticação necessária.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const favIds = db.favoritesByUser[user.id] || [];
    return HttpResponse.json({ nftIds: favIds });
  }),

  http.post('/api/favorites/:nftId', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Faça login para favoritar NFTs.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const nftId = String(params.nftId);
    const nft = db.nfts.find((n) => n.id === nftId);
    if (!nft) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'NFT não encontrado.' },
        { status: 404 }
      );
    }

    const list = db.favoritesByUser[user.id] || [];
    if (!list.includes(nftId)) {
      list.push(nftId);
    }
    db.favoritesByUser[user.id] = list;
    saveDb(db);

    return HttpResponse.json({ nftIds: list });
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Faça login para gerenciar favoritos.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const nftId = String(params.nftId);
    const list = (db.favoritesByUser[user.id] || []).filter((id) => id !== nftId);
    db.favoritesByUser[user.id] = list;
    saveDb(db);

    return HttpResponse.json({ nftIds: list });
  }),

  // ==========================================
  // 4. Cart & Coupon
  // ==========================================
  http.get('/api/cart', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const db = getDb();
    const ownerKey = getCartOwnerKey(request);
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const body = (await request.json()) as {
      nftId: string;
      edition?: EditionType;
      quantity?: number;
    };

    const db = getDb();
    const nft = db.nfts.find((n) => n.id === body.nftId);
    if (!nft) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'NFT não encontrado.' },
        { status: 404 }
      );
    }

    const edition = body.edition || nft.defaultEdition;
    const edInfo = nft.editions.find((e) => e.edition === edition);
    if (!edInfo || edInfo.available <= 0) {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: `A edição ${edition} está esgotada.`,
        },
        { status: 409 }
      );
    }

    const addQty = Math.max(1, Math.floor(body.quantity || 1));
    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };

    const existing = rawCart.items.find(
      (i) => i.nftId === nft.id && i.edition === edition
    );

    if (existing) {
      const nextQty = existing.quantity + addQty;
      if (nextQty > edInfo.available) {
        return HttpResponse.json(
          {
            code: 'CONFLICT',
            message: `Limite disponível atingido para a edição ${edition} (${edInfo.available} disponíveis).`,
          },
          { status: 409 }
        );
      }
      existing.quantity = nextQty;
      existing.unitPriceEth = edInfo.priceEth;
      existing.available = edInfo.available;
      existing.lineTotalEth = mulEth(edInfo.priceEth, nextQty);
      existing.nftVersion = nft.version;
      existing.priceChanged = false;
      existing.stockChanged = false;
    } else {
      if (addQty > edInfo.available) {
        return HttpResponse.json(
          {
            code: 'CONFLICT',
            message: `Quantidade solicitada (${addQty}) excede a disponibilidade (${edInfo.available}).`,
          },
          { status: 409 }
        );
      }
      rawCart.items.push(buildCartItemFromNft(nft, edition, addQty));
    }

    db.cartsByOwner[ownerKey] = rawCart;
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.patch('/api/cart/items/:itemId', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const itemId = decodeURIComponent(String(params.itemId));
    const body = (await request.json()) as { quantity: number; acknowledgeChanges?: boolean };
    const nextQty = Math.floor(body.quantity);

    const db = getDb();
    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
    const idx = rawCart.items.findIndex((i) => i.id === itemId);

    if (idx === -1) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Item não encontrado no carrinho.' },
        { status: 404 }
      );
    }

    if (nextQty <= 0) {
      rawCart.items.splice(idx, 1);
    } else {
      const item = rawCart.items[idx];
      const nft = db.nfts.find((n) => n.id === item.nftId);
      const edInfo = nft?.editions.find((e) => e.edition === item.edition);
      if (!nft || !edInfo) {
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: 'Edição do NFT não encontrada.' },
          { status: 404 }
        );
      }
      if (nextQty > edInfo.available) {
        return HttpResponse.json(
          {
            code: 'CONFLICT',
            message: `Apenas ${edInfo.available} unidade(s) disponível(is) para ${nft.title} (${item.edition}).`,
          },
          { status: 409 }
        );
      }
      item.quantity = nextQty;
      item.unitPriceEth = edInfo.priceEth;
      item.available = edInfo.available;
      item.lineTotalEth = mulEth(edInfo.priceEth, nextQty);
      item.nftVersion = nft.version;
      if (body.acknowledgeChanges) {
        item.priceChanged = false;
        item.stockChanged = false;
      }
    }

    db.cartsByOwner[ownerKey] = rawCart;
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.delete('/api/cart/items/:itemId', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const itemId = decodeURIComponent(String(params.itemId));
    const db = getDb();
    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
    rawCart.items = rawCart.items.filter((i) => i.id !== itemId);
    if (rawCart.items.length === 0) {
      rawCart.couponCode = null;
    }
    db.cartsByOwner[ownerKey] = rawCart;
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.post('/api/cart/coupon', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const body = (await request.json()) as { code?: string };
    const code = (body.code || '').trim().toUpperCase();

    const db = getDb();
    const coupon = db.coupons.find((c) => c.code.toUpperCase() === code);

    if (!coupon) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Código promocional inválido ou não encontrado.',
          fieldErrors: { coupon: 'Código promocional inválido' },
        },
        { status: 400 }
      );
    }

    if (new Date(coupon.expiresAt).getTime() <= Date.now()) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Este cupom promocional expirou.',
          fieldErrors: { coupon: 'Cupom expirado' },
        },
        { status: 400 }
      );
    }

    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
    rawCart.couponCode = coupon.code;
    db.cartsByOwner[ownerKey] = rawCart;
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const db = getDb();
    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
    rawCart.couponCode = null;
    db.cartsByOwner[ownerKey] = rawCart;
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);

    return HttpResponse.json(cartState);
  }),

  http.post('/api/cart/acknowledge', async ({ request }) => {
    const db = getDb();
    const ownerKey = getCartOwnerKey(request);
    const rawCart = db.cartsByOwner[ownerKey] || { items: [], couponCode: null };
    for (const item of rawCart.items) {
      item.priceChanged = false;
      item.stockChanged = false;
    }
    const cartState = computeQuoteFromOwnerCart(db, ownerKey);
    saveDb(db);
    return HttpResponse.json(cartState);
  }),

  // ==========================================
  // 5. Quote Validation (/api/quote)
  // ==========================================
  http.post('/api/quote', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const body = (await request.json()) as QuoteRequest;
    const db = getDb();
    const issues: QuoteIssue[] = [];
    const evaluatedItems = [];

    for (const reqItem of body.items || []) {
      const nft = db.nfts.find((n) => n.id === reqItem.nftId);
      if (!nft) {
        issues.push({
          type: 'EDITION_UNAVAILABLE',
          nftId: reqItem.nftId,
          message: `O NFT ${reqItem.nftId} não está mais disponível.`,
        });
        continue;
      }

      const ed = nft.editions.find((e) => e.edition === reqItem.edition);
      if (!ed || ed.available <= 0) {
        issues.push({
          type: 'EDITION_UNAVAILABLE',
          nftId: nft.id,
          edition: reqItem.edition,
          availableStock: 0,
          message: `${nft.title} (${reqItem.edition}) esgotou durante a navegação.`,
        });
      } else if (ed.available < reqItem.quantity) {
        issues.push({
          type: 'INSUFFICIENT_STOCK',
          nftId: nft.id,
          edition: reqItem.edition,
          availableStock: ed.available,
          message: `Disponibilidade de ${nft.title} (${reqItem.edition}) mudou para ${ed.available} unidade(s).`,
        });
      }

      const currentPrice = ed ? ed.priceEth : nft.priceEth;
      if (
        reqItem.expectedUnitPriceEth &&
        formatEthPrecise(reqItem.expectedUnitPriceEth) !== formatEthPrecise(currentPrice)
      ) {
        issues.push({
          type: 'PRICE_CHANGED',
          nftId: nft.id,
          edition: reqItem.edition,
          previousPriceEth: reqItem.expectedUnitPriceEth,
          currentPriceEth: currentPrice,
          message: `O preço de ${nft.title} mudou de ${reqItem.expectedUnitPriceEth} ETH para ${currentPrice} ETH.`,
        });
      }

      evaluatedItems.push({
        id: `${nft.id}:${reqItem.edition}`,
        nftId: nft.id,
        tokenId: nft.tokenId,
        title: nft.title,
        image: nft.image,
        edition: reqItem.edition,
        quantity: reqItem.quantity,
        unitPriceEth: currentPrice,
        available: ed ? ed.available : 0,
        lineTotalEth: mulEth(currentPrice, reqItem.quantity),
        nftVersion: nft.version,
      });
    }

    let discountPercent = 0;
    let validCoupon: string | null = null;
    if (body.couponCode) {
      const coupon = db.coupons.find(
        (c) => c.code.toUpperCase() === body.couponCode?.trim().toUpperCase()
      );
      if (!coupon) {
        issues.push({
          type: 'COUPON_INVALID',
          message: `O cupom ${body.couponCode} é inválido.`,
        });
      } else if (new Date(coupon.expiresAt).getTime() <= Date.now()) {
        issues.push({
          type: 'COUPON_EXPIRED',
          message: `O cupom ${body.couponCode} expirou.`,
        });
      } else {
        discountPercent = coupon.discountPercent;
        validCoupon = coupon.code;
      }
    }

    const subtotalEth =
      evaluatedItems.length > 0
        ? addEth(...evaluatedItems.map((i) => i.lineTotalEth))
        : '0.00';
    const discountEth =
      discountPercent > 0 ? percentOfEth(subtotalEth, discountPercent) : '0.00';
    const afterDiscount = subEth(subtotalEth, discountEth);
    const networkFeeEth = computeNetworkFeeEth(
      body.network || 'Ethereum',
      evaluatedItems.length
    );
    const totalEth =
      evaluatedItems.length > 0 ? addEth(afterDiscount, networkFeeEth) : '0.00';

    const ownerKey = getCartOwnerKey(request);
    const currentCartQuote = computeQuoteFromOwnerCart(
      db,
      ownerKey,
      body.network || 'Ethereum'
    );

    return HttpResponse.json({
      valid: issues.length === 0,
      quoteHash: currentCartQuote.quoteHash,
      items: evaluatedItems,
      couponCode: validCoupon,
      discountPercent,
      subtotalEth: formatEthPrecise(subtotalEth),
      discountEth: formatEthPrecise(discountEth),
      networkFeeEth,
      totalEth: formatEthPrecise(totalEth),
      issues,
      calculatedAt: new Date().toISOString(),
    });
  }),

  // ==========================================
  // 6. Orders (Idempotent Creation & Query)
  // ==========================================
  http.post('/api/orders', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        {
          code: error || 'UNAUTHORIZED',
          message:
            error === 'SESSION_EXPIRED'
              ? 'Sua sessão expirou. Faça login novamente para concluir a compra.'
              : 'Faça login para finalizar o pedido.',
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateOrderInput;
    const headerIdempKey = request.headers.get('Idempotency-Key');
    const idempotencyKey = headerIdempKey || body.idempotencyKey;

    if (!idempotencyKey) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Chave de idempotência obrigatória.',
        },
        { status: 400 }
      );
    }

    const db = getDb();

    // Fingerprint of the order payload to detect reuse of same idempotencyKey with different content
    const fingerprint = JSON.stringify({
      userId: user.id,
      items: body.items.map((i) => ({
        nftId: i.nftId,
        edition: i.edition,
        quantity: i.quantity,
        unitPriceEth: formatEthPrecise(i.unitPriceEth),
      })),
      couponCode: body.couponCode || null,
      walletAddress: body.collector?.walletAddress,
    });

    const existingOrder = db.orders.find(
      (o) => o.idempotencyKey === idempotencyKey && o.userId === user.id
    );

    if (existingOrder) {
      if (existingOrder.requestFingerprint !== fingerprint) {
        return HttpResponse.json(
          {
            code: 'IDEMPOTENCY_CONFLICT',
            message:
              'Esta chave de idempotência já foi utilizada com parâmetros de pedido diferentes.',
          },
          { status: 409 }
        );
      }
      // Return the exact same order without duplicating!
      if (existingOrder.status === 'pending') {
        setTimeout(() => {
          transitionOrderStatusAndBroadcast(existingOrder.id, 'confirmed');
        }, 120);
      }
      return HttpResponse.json(existingOrder, { status: 200 });
    }

    // Check wallet simulation outcome (reject / disconnect)
    if (db.sim.walletActionOutcome === 'reject') {
      return HttpResponse.json(
        {
          code: 'WALLET_REJECTED',
          message: 'Transação recusada na carteira pelo colecionador.',
        },
        { status: 400 }
      );
    }

    if (db.sim.walletActionOutcome === 'disconnect') {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: 'A carteira foi desconectada durante a assinatura. Reconecte e tente novamente.',
        },
        { status: 409 }
      );
    }

    // Revalidate price, stock, and coupon before accepting the order
    const issues: QuoteIssue[] = [];
    for (const item of body.items) {
      const nft = db.nfts.find((n) => n.id === item.nftId);
      const ed = nft?.editions.find((e) => e.edition === item.edition);
      if (!nft || !ed || ed.available <= 0) {
        issues.push({
          type: 'EDITION_UNAVAILABLE',
          nftId: item.nftId,
          edition: item.edition,
          availableStock: 0,
          message: `A edição ${item.edition} de ${nft?.title || item.nftId} esgotou.`,
        });
      } else if (ed.available < item.quantity) {
        issues.push({
          type: 'INSUFFICIENT_STOCK',
          nftId: nft.id,
          edition: item.edition,
          availableStock: ed.available,
          message: `Estoque insuficiente para ${nft.title} (${ed.available} disponíveis).`,
        });
      } else if (
        formatEthPrecise(ed.priceEth) !== formatEthPrecise(item.unitPriceEth)
      ) {
        issues.push({
          type: 'PRICE_CHANGED',
          nftId: nft.id,
          edition: item.edition,
          previousPriceEth: item.unitPriceEth,
          currentPriceEth: ed.priceEth,
          message: `O preço de ${nft.title} mudou de ${item.unitPriceEth} ETH para ${ed.priceEth} ETH.`,
        });
      }
    }

    const currentCartQuote = computeQuoteFromOwnerCart(
      db,
      user.id,
      body.collector.network
    );

    if (issues.length > 0 || body.quoteHash !== currentCartQuote.quoteHash) {
      return HttpResponse.json(
        {
          code: 'QUOTE_OUTDATED',
          message:
            issues[0]?.message ||
            'Os valores ou a disponibilidade mudaram. Revise a cotação atualizada e confirme novamente.',
          details: {
            issues,
            updatedQuote: currentCartQuote,
          },
        },
        { status: 409 }
      );
    }

    // Build immutable order snapshot
    const snapshotItems = body.items.map((i) => {
      const nft = db.nfts.find((n) => n.id === i.nftId)!;
      return {
        nftId: nft.id,
        tokenId: nft.tokenId,
        title: nft.title,
        image: nft.image,
        edition: i.edition,
        quantity: i.quantity,
        unitPriceEth: formatEthPrecise(i.unitPriceEth),
        subtotalEth: mulEth(i.unitPriceEth, i.quantity),
      };
    });

    const subtotalEth = addEth(...snapshotItems.map((i) => i.subtotalEth));
    let discountPercent = 0;
    let couponCode: string | null = null;
    if (body.couponCode) {
      const c = db.coupons.find(
        (cp) => cp.code.toUpperCase() === body.couponCode?.toUpperCase()
      );
      if (c && new Date(c.expiresAt).getTime() > Date.now()) {
        discountPercent = c.discountPercent;
        couponCode = c.code;
      }
    }
    const discountEth =
      discountPercent > 0 ? percentOfEth(subtotalEth, discountPercent) : '0.00';
    const networkFeeEth = computeNetworkFeeEth(
      body.collector.network,
      snapshotItems.length
    );
    const totalEth = addEth(subEth(subtotalEth, discountEth), networkFeeEth);

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const txHash = '0xA91F...E82C';
    const now = new Date().toISOString();

    const newOrder: OrderReceipt = {
      id: orderId,
      userId: user.id,
      idempotencyKey,
      requestFingerprint: fingerprint,
      status: 'pending',
      txHash,
      explorerUrl: `https://etherscan.io/tx/0xA91F234567890ABCDE1234567890ABCDEF12E82C`,
      network: body.collector.network,
      walletProvider: body.collector.walletProvider,
      walletAddress: body.collector.walletAddress,
      collector: body.collector,
      items: snapshotItems,
      couponCode,
      subtotalEth: formatEthPrecise(subtotalEth),
      discountEth: formatEthPrecise(discountEth),
      networkFeeEth,
      totalEth: formatEthPrecise(totalEth),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    db.orders.unshift(newOrder);
    saveDb(db);

    const outcome = db.sim.orderOutcome;
    const delayMs = db.sim.orderConfirmationDelayMs ?? 500;

    if (outcome === 'timeout_then_pending') {
      // Reset outcome to 'confirm' for subsequent retry so idempotency recovery finds the order
      db.sim.orderOutcome = 'confirm';
      saveDb(db);

      await delay(200);
      return HttpResponse.json(
        {
          code: 'NETWORK_TIMEOUT',
          message: 'Tempo limite de resposta excedido ao aguardar confirmação da rede.',
          details: { orderId: newOrder.id, idempotencyKey },
        },
        { status: 504 }
      );
    }

    // Schedule real-time Socket.IO transition
    setTimeout(() => {
      if (outcome === 'decline') {
        transitionOrderStatusAndBroadcast(
          newOrder.id,
          'declined',
          'Pagamento recusado pelo contrato inteligente / saldo insuficiente.'
        );
      } else {
        transitionOrderStatusAndBroadcast(newOrder.id, 'confirmed');
      }
    }, delayMs);

    return HttpResponse.json(newOrder, { status: 201 });
  }),

  http.get('/api/orders', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const userOrders = db.orders.filter((o) => o.userId === user.id);
    return HttpResponse.json({ orders: userOrders });
  }),

  http.get('/api/orders/:orderId', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const orderId = String(params.orderId);
    const order = db.orders.find((o) => o.id === orderId);

    if (!order) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Pedido não encontrado.' },
        { status: 404 }
      );
    }

    if (order.userId !== user.id) {
      return HttpResponse.json(
        { code: 'FORBIDDEN', message: 'Você não tem permissão para visualizar este pedido.' },
        { status: 403 }
      );
    }

    return HttpResponse.json(order);
  }),

  // ==========================================
  // 7. Profile & Password
  // ==========================================
  http.get('/api/profile', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const { passwordHash: _omitted, ...safeUser } = user;
    return HttpResponse.json(safeUser);
  }),

  http.put('/api/profile', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as UpdateProfileInput;
    const fieldErrors: Record<string, string> = {};
    if (!body.displayName || body.displayName.trim().length < 2) {
      fieldErrors.displayName = 'Nome de exibição deve ter pelo menos 2 caracteres';
    }
    if (!body.username || body.username.trim().length < 3) {
      fieldErrors.username = 'Nome de usuário deve ter pelo menos 3 caracteres';
    }
    if (!body.email || !body.email.includes('@')) {
      fieldErrors.email = 'Informe um e-mail válido';
    }
    if (!body.ensName || body.ensName.trim().length < 2) {
      fieldErrors.ensName = 'Informe um nome ENS válido';
    }
    if (!body.walletNickname || body.walletNickname.trim().length < 2) {
      fieldErrors.walletNickname = 'Informe o apelido da carteira';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Corrija os erros no formulário de perfil.',
          fieldErrors,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const conflictEmail = db.users.find(
      (u) => u.id !== user.id && u.email.toLowerCase() === body.email.trim().toLowerCase()
    );
    if (conflictEmail) {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: 'Este e-mail já está vinculado a outra conta.',
          fieldErrors: { email: 'E-mail já em uso por outro colecionador' },
        },
        { status: 409 }
      );
    }

    user.displayName = body.displayName.trim();
    user.username = body.username.trim();
    user.email = body.email.trim();
    user.ensName = body.ensName.trim();
    user.ensDomain = body.ensDomain || '.eth';
    user.walletNickname = body.walletNickname.trim();
    if (body.avatarUrl !== undefined) {
      user.avatarUrl = body.avatarUrl;
    }

    saveDb(db);
    const { passwordHash: _omitted, ...safeUser } = user;
    return HttpResponse.json(safeUser);
  }),

  http.put('/api/profile/password', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ChangePasswordInput;
    if (!verifyPassword(body.currentPassword || '', user.passwordHash)) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'A senha atual informada está incorreta.',
          fieldErrors: { currentPassword: 'Senha atual incorreta' },
        },
        { status: 400 }
      );
    }

    if (!body.newPassword || body.newPassword.length < 6) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'A nova senha deve ter pelo menos 6 caracteres.',
          fieldErrors: { newPassword: 'Mínimo de 6 caracteres' },
        },
        { status: 400 }
      );
    }

    if (body.newPassword !== body.confirmNewPassword) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'A confirmação da nova senha não confere.',
          fieldErrors: { confirmNewPassword: 'As senhas não coincidem' },
        },
        { status: 400 }
      );
    }

    const db = getDb();
    user.passwordHash = hashPassword(body.newPassword);
    saveDb(db);

    return HttpResponse.json({ ok: true, message: 'Senha atualizada com sucesso.' });
  }),

  // ==========================================
  // 8. Wallets (Primary & Secondary)
  // ==========================================
  http.get('/api/wallets', async ({ request }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const wallets = db.walletsByUser[user.id] || [];
    return HttpResponse.json({ wallets });
  }),

  http.put('/api/wallets/:kind', async ({ request, params }) => {
    const simResp = await applyNetworkSimulation(request);
    if (simResp) return simResp;

    const { error, user } = getAuthenticatedUser(request);
    if (error || !user) {
      return HttpResponse.json(
        { code: error || 'UNAUTHORIZED', message: 'Não autenticado.' },
        { status: 401 }
      );
    }

    const kind = String(params.kind) as 'primary' | 'secondary';
    if (kind !== 'primary' && kind !== 'secondary') {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Tipo de carteira inválido.' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpsertWalletInput;
    const fieldErrors: Record<string, string> = {};
    if (!body.displayName || body.displayName.trim().length < 2) {
      fieldErrors.displayName = 'Nome de exibição obrigatório';
    }
    if (!body.nickname || body.nickname.trim().length < 2) {
      fieldErrors.nickname = 'Apelido da carteira obrigatório';
    }
    if (!body.profileName || body.profileName.trim().length < 2) {
      fieldErrors.profileName = 'Nome do perfil obrigatório';
    }
    if (
      !body.address ||
      !/^0x[a-fA-F0-9]{4,40}$|^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/.test(
        body.address.trim()
      )
    ) {
      fieldErrors.address = 'Endereço 0x inválido';
    }
    if (!body.referralCode || body.referralCode.trim().length < 2) {
      fieldErrors.referralCode = 'Código de indicação obrigatório';
    }
    if (!body.email || !body.email.includes('@')) {
      fieldErrors.email = 'E-mail inválido';
    }
    if (!body.ensName || body.ensName.trim().length < 2) {
      fieldErrors.ensName = 'Nome ENS obrigatório';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos obrigatórios da carteira.',
          fieldErrors,
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const list = db.walletsByUser[user.id] || [];
    const existingIdx = list.findIndex((w) => w.kind === kind);

    const updatedWallet = {
      id: existingIdx >= 0 ? list[existingIdx].id : `wallet-${kind}-${Date.now()}`,
      userId: user.id,
      kind,
      displayName: body.displayName.trim(),
      nickname: body.nickname.trim(),
      network: body.network || 'Ethereum',
      profileName: body.profileName.trim(),
      address: body.address.trim(),
      secondaryEnsOrAddress: body.secondaryEnsOrAddress || '',
      provider: body.provider || 'MetaMask',
      referralCode: body.referralCode.trim(),
      email: body.email.trim(),
      ensName: body.ensName.trim(),
      ensDomain: body.ensDomain || '.eth',
      isConnected: body.isConnected ?? true,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = updatedWallet;
    } else {
      list.push(updatedWallet);
    }
    db.walletsByUser[user.id] = list;
    saveDb(db);

    return HttpResponse.json({ wallet: updatedWallet, wallets: list });
  }),

  // ==========================================
  // 9. Simulation & Test Control Endpoints
  // ==========================================
  http.get('/api/__sim__/state', () => {
    const db = getDb();
    return HttpResponse.json({
      sim: db.sim,
      nftsCount: db.nfts.length,
      ordersCount: db.orders.length,
    });
  }),

  http.post('/api/__sim__/config', async ({ request }) => {
    const patch = (await request.json()) as Partial<SimulationConfig>;
    const db = getDb();
    db.sim = { ...db.sim, ...patch };
    saveDb(db);
    return HttpResponse.json({ sim: db.sim });
  }),

  http.post('/api/__sim__/reset', async ({ request }) => {
    let seedCart = false;
    try {
      const body = (await request.json()) as { seedCartWithFigmaItems?: boolean };
      seedCart = Boolean(body?.seedCartWithFigmaItems);
    } catch {
      // Empty body allowed
    }
    const fresh = resetDb(seedCart);
    return HttpResponse.json({ ok: true, sim: fresh.sim });
  }),

  http.post('/api/__sim__/emit-nft-updated', async ({ request }) => {
    const body = (await request.json()) as {
      nftId: string;
      edition?: EditionType;
      priceEth?: string;
      available?: number;
      forceVersion?: number;
      forceEventId?: string;
    };
    const event = updateNftPriceOrStockAndBroadcast(body);
    if (!event) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'NFT not found' }, { status: 404 });
    }
    return HttpResponse.json({ event });
  }),

  http.post('/api/__sim__/emit-order-updated', async ({ request }) => {
    const body = (await request.json()) as {
      orderId: string;
      status: 'confirmed' | 'declined';
      failureReason?: string;
      forceVersion?: number;
      forceEventId?: string;
    };
    const event = transitionOrderStatusAndBroadcast(
      body.orderId,
      body.status,
      body.failureReason,
      body.forceVersion,
      body.forceEventId
    );
    if (!event) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Order not found' }, { status: 404 });
    }
    return HttpResponse.json({ event });
  }),

  http.post('/api/__sim__/disconnect-sockets', () => {
    disconnectAllMockSockets();
    return HttpResponse.json({ ok: true });
  }),
];
