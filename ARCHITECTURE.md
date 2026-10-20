# Arquitetura Técnica — Kurio NFT Marketplace

Este documento detalha as decisões arquiteturais, os contratos de rede **REST** e **Socket.IO**, a estratégia de cache e invalidação com **TanStack Query**, a reconciliação de eventos em tempo real, o isolamento de sessão e as decisões de UX/Acessibilidade adotadas na implementação do **Kurio NFT Marketplace**.

---

## 1. Visão Geral e Estrutura de Diretórios

A aplicação segue uma arquitetura modular orientada a domínio (*feature-sliced*), separando de maneira estrita os contratos de dados, a camada de transporte HTTP/WebSocket, o estado assíncrono no cliente e a camada de simulação de rede (MSW):

```text
src/
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx         # Header responsivo, navegação mobile inferior, Footer e guardas de rota
│   │   └── sim-devtools.tsx      # Painel flutuante de controle de cenários MSW e eventos Socket.IO
│   └── ui/                       # Primitivos acessíveis (Dialog c/ focus trap, Toast, Skeleton c/ shimmer, Input, Button)
├── features/
│   ├── auth/                     # Contexto de sessão, reautenticação contextual e modal de Login/Cadastro
│   ├── catalog/                  # Catálogo paginado/filtrado sincronizado com URL, NftCard e Detalhes do NFT
│   ├── favorites/                # Hook de favoritos com mutação otimista e rollback automático
│   ├── cart/                     # Hook e página do Carrinho com cálculo preciso em ETH e avisos em tempo real
│   ├── checkout/                 # Checkout com validação de cotação, Idempotency-Key e Recibo Confirmado
│   └── account/                  # Edição de Perfil, Avatar, Senha e Carteiras (Principal e Secundária)
├── lib/
│   ├── api.ts                    # Cliente Axios, injeção de token/Idempotency-Key e normalização AppApiError
│   ├── eth.ts                    # Aritmética decimal exata em ETH usando decimal.js
│   ├── query.ts                  # Configuração do QueryClient, fábrica de QueryKeys e expurgo de dados privados
│   └── socket.ts                 # Gerenciador Socket.IO com deduplicação por eventId, versão e reconciliação
├── mocks/
│   ├── browser.ts                # Inicialização do Service Worker MSW (HTTP + WebSocket)
│   ├── db.ts                     # Banco persistente em localStorage, fixtures ricas e motor de cotação
│   ├── handlers.ts               # Handlers REST (/api/auth, /api/nfts, /api/favorites, /api/cart, /api/quote, /api/orders, /api/profile, /api/wallets)
│   └── ws.ts                     # Interceptador WebSocket com @mswjs/socket.io-binding
└── types/
    └── contracts.ts              # Schemas Zod e tipos TypeScript compartilhados entre cliente e MSW
```

---

## 2. Contratos REST e Eventos Socket.IO

### 2.1. Endpoints REST

Todos os endpoints são interceptados no nível de rede pelo **MSW (`src/mocks/handlers.ts`)** e consumidos pelo cliente exclusivamente via **Axios (`src/lib/api.ts`)**:

| Domínio | Método & Rota | Autenticação | Descrição e Regras de Negócio |
| :--- | :--- | :---: | :--- |
| **Sessão** | `POST /api/auth/login` | Pública | Autentica por e-mail/senha, mescla carrinho `guest` ao carrinho do usuário e retorna `{ token, expiresAt, user }` |
| **Sessão** | `POST /api/auth/register` | Pública | Valida unicidade de e-mail/username (`409 CONFLICT`), transfere carrinho `guest` e cria carteira padrão |
| **Sessão** | `GET /api/auth/session` | Bearer Token | Restaura sessão ativa ou retorna `401 SESSION_EXPIRED` |
| **Sessão** | `POST /api/auth/logout` | Bearer Token | Revoga o token da sessão atual |
| **Catálogo** | `GET /api/nfts` | Pública | Suporta `q`, `categories`, `networks`, `minPrice`, `maxPrice`, `tab` (`all`, `new`, `trending`), `sort` (`recent`, `price_asc`, `price_desc`, `popular`), `page`, `limit`. Retorna itens paginados e contadores de facetas (`facets`) |
| **Catálogo** | `GET /api/nfts/:id` | Pública | Retorna detalhes completos do NFT, galeria, edições (`1/1`, `1/10`, `1/50`, `ABERTA`), estoque por edição, avaliações e `version` (`404 NOT_FOUND` se inexistente) |
| **Favoritos** | `GET /api/favorites` | Bearer Token | Lista IDs dos NFTs favoritados pelo usuário autenticado |
| **Favoritos** | `POST /api/favorites/:nftId` | Bearer Token | Adiciona NFT aos favoritos do usuário |
| **Favoritos** | `DELETE /api/favorites/:nftId` | Bearer Token | Remove NFT dos favoritos do usuário |
| **Carrinho** | `GET /api/cart` | Opcional | Retorna itens do carrinho (`guest` ou `userId`), subtotal, desconto, taxa de rede (`0.016 ETH`), total e `quoteHash` |
| **Carrinho** | `POST /api/cart/items` | Opcional | Adiciona `{ nftId, edition, quantity }` respeitando limite de estoque disponível (`409 CONFLICT` se exceder) |
| **Carrinho** | `PATCH /api/cart/items/:itemId` | Opcional | Atualiza quantidade de uma edição específica ou remove se `quantity <= 0` |
| **Carrinho** | `DELETE /api/cart/items/:itemId` | Opcional | Remove item do carrinho; limpa cupom automaticamente caso o carrinho fique vazio |
| **Carrinho** | `POST /api/cart/coupon` | Opcional | Valida e aplica cupom (`KURIO10`, `GREEN20`, `EXPIRADO50` -> `400 VALIDATION_ERROR`) |
| **Carrinho** | `DELETE /api/cart/coupon` | Opcional | Remove cupom ativo e recalcula cotação |
| **Cotação** | `POST /api/quote` | Opcional | Revalida preços unitários esperados, disponibilidade por edição e validade do cupom antes do envio do pedido |
| **Pedidos** | `POST /api/orders` | Bearer Token | Requer cabeçalho `Idempotency-Key`. Valida `quoteHash` (`409 QUOTE_OUTDATED`), cria snapshot imutável com status inicial `pending` e dispara transição assíncrona via Socket.IO |
| **Pedidos** | `GET /api/orders/:orderId` | Bearer Token | Retorna recibo do pedido (`403 FORBIDDEN` se pertencer a outro usuário) |
| **Perfil** | `GET /api/profile` / `PUT /api/profile` | Bearer Token | Consulta e atualiza dados do colecionador e avatar (`409 CONFLICT` para e-mail duplicado) |
| **Senha** | `PUT /api/profile/password` | Bearer Token | Valida senha atual e confirmação antes de atualizar o hash |
| **Carteiras** | `GET /api/wallets` / `PUT /api/wallets/:kind` | Bearer Token | Lista e salva configurações das carteiras `primary` e `secondary` com validação de endereço `0x` |

### 2.2. Contratos de Eventos Socket.IO

O canal em tempo real opera sobre `socket.io-client` interceptado no navegador via `ws.link` + `@mswjs/socket.io-binding` (`src/mocks/ws.ts`). Todos os eventos carregam metadados obrigatórios de rastreabilidade e ordenação:

```ts
// 1. Atualização de preço ou estoque de um NFT/Edição
interface NftUpdatedEvent {
  eventId: string;        // Identificador único p/ deduplicação (ex: "evt_nft_101_2")
  resourceId: string;     // ID do NFT (ex: "emerald-ape-042")
  version: number;        // Versão monotônica crescente do recurso
  timestamp: string;      // ISO 8601
  payload: {
    nftId: string;
    edition: '1/1' | '1/10' | '1/50' | 'ABERTA';
    priceEth: string;
    available: number;
    nft: NftItem;
  };
}

// 2. Transição de status de um pedido
interface OrderUpdatedEvent {
  eventId: string;        // Identificador único p/ deduplicação (ex: "evt_order_102_2")
  resourceId: string;     // ID do pedido (ex: "ord_1729...")
  userId: string;         // ID do colecionador proprietário do pedido
  version: number;        // Versão monotônica do pedido
  timestamp: string;      // ISO 8601
  payload: {
    order: OrderReceipt;  // Snapshot atualizado ('pending' | 'confirmed' | 'declined')
  };
}
```

---

## 3. Política de Sessão, Carrinho e Isolamento entre Contas

1. **Acesso Público vs. Rotas Privadas**:
   - **Públicas**: Início/Catálogo (`/`), Detalhes do NFT (`/nft/:nftId`) e Carrinho (`/carrinho`). Visitantes deslogados podem explorar o catálogo, selecionar edições e montar o carrinho livremente.
   - **Privadas**: Favoritar NFTs, Checkout (`/pagamento`), Recibo do Pedido (`/pedido/:orderId`), Perfil (`/perfil`) e Carteiras (`/carteiras`).
2. **Preservação de Intenção na Autenticação**:
   - Ao clicar em **Favoritar** deslogado, o modal de autenticação é aberto registrando um callback `onSuccess` que executa a mutação de favorito imediatamente após o login.
   - Ao clicar em **Finalizar compra** no carrinho deslogado, o modal de autenticação armazena `redirectTo: '/pagamento'` e mescla o carrinho de visitante (`guest`) com o carrinho da conta autenticada sem perda de itens.
   - Se a sessão expirar (`401 SESSION_EXPIRED`) enquanto o colecionador preenche o formulário de Checkout ou Perfil, os estados locais dos inputs são mantidos na árvore React e o modal de reautenticação permite renovar o token e concluir o envio sem redigitar os dados.
3. **Isolamento de Dados Privados no Logout e Troca de Usuário**:
   - Todas as chaves privadas do TanStack Query incluem o `userId` (`['favorites', userId]`, `['cart', userId]`, `['wallets', userId]`, `['orders', 'detail', userId, orderId]`).
   - No `logout()` ou ao autenticar com um `userId` diferente do anterior, `purgePrivateQueries(queryClient)` (`src/lib/query.ts`) remove imediatamente do cache em memória todos os registros de `favorites`, `profile`, `wallets`, `orders` e `cart`, além de limpar `sessionStorage` de checkout pendente e reassociar o `socketManager` ao novo `userId`.

---

## 4. Estratégia de Cache (TanStack Query) e Concorrência

- **Estrutura de Chaves (`queryKeys` em `src/lib/query.ts`)**:
  - `['nfts', 'list', params]`: Cache granular por combinação de busca, categorias, redes, faixa de preço, aba, ordenação e página (`staleTime: 15s`, `placeholderData: keepPreviousData` para transições suaves de paginação).
  - `['nfts', 'detail', nftId]`: Cache individual por NFT (`staleTime: 15s`).
  - `['favorites', userId]`: Lista de favoritos com **mutação otimista** (`onMutate` cancela refetches em voo, aplica snapshot otimista e faz rollback em `onError`).
- **Prevenção de Respostas Fora de Ordem (*Race Conditions*)**:
  - Os `queryFn` do catálogo e detalhe repassam o `signal` (`AbortSignal`) do TanStack Query diretamente para o Axios (`api.nfts.list(params, signal)`).
  - Quando o usuário altera rapidamente a busca (ex.: digita `"E"` e logo em seguida `"Emerald"`), a requisição anterior é cancelada via `AbortSignal` e isolada em sua própria chave de query, garantindo que uma resposta lenta antiga jamais sobrescreva a visualização atual.

---

## 5. Reconciliação entre REST e Socket.IO

O `RealtimeSocketManager` (`src/lib/socket.ts`) coordena a consistência entre o estado carregado via REST e os eventos assíncronos recebidos via WebSocket:

1. **Deduplicação por `eventId`**:
   - Mantém um `Set<string>` (`processedEventIds`). Eventos retransmitidos com o mesmo `eventId` são descartados em $O(1)$.
2. **Ordenação Monotônica por `version`**:
   - Mantém um mapa `resourceVersions` (`nft:<id>` e `order:<id>`), semeado (`seedNftVersion` / `seedOrderVersion`) sempre que uma resposta REST é carregada.
   - Qualquer evento Socket.IO com `event.version <= lastKnownVersion` é ignorado como obsoleto (*stale*), impedindo regressão de preço, estoque ou status.
3. **Proteção de Estados Terminais de Pedido**:
   - Caso um pedido já esteja em estado terminal (`confirmed` ou `declined`) no cache do TanStack Query, eventos atrasados contendo status `pending` ou versões inferiores jamais revertem o estado do recibo.
4. **Invalidação e Atualização Cirúrgica**:
   - Ao receber um `nft.updated` válido, o gerenciador atualiza `['nfts', 'detail', id]` e `['nfts', 'list']` in-place via `setQueryData`, e invalida `['cart']` para que o carrinho e o checkout recalculem o `quoteHash` e exibam o banner de confirmação obrigatória caso o item afetado esteja na compra.
5. **Reconciliação Automática Pós-Reconexão**:
   - Se a conexão WebSocket cair e reconectar (`connect` após `hadConnectedOnce === true`), `reconcileAfterReconnect()` invalida as queries ativas de `nfts`, `cart` e `orders`, buscando via REST quaisquer atualizações ocorridas durante a janela de desconexão.

---

## 6. Precisão Matemática em ETH e Idempotência no Checkout

- **Aritmética Decimal (`src/lib/eth.ts`)**:
  - Valores monetários trafegam nos contratos como strings decimais (`"1.19"`, `"0.016"`) e todas as operações (`addEth`, `subEth`, `mulEth`, `percentOfEth`) utilizam `Decimal` (`decimal.js`) configurado com `ROUND_HALF_UP`, evitando discrepâncias de ponto flutuante binário (como `0.1 + 0.2 = 0.30000000000000004`).
- **Idempotência e Recuperação de Timeout (`POST /api/orders`)**:
  - Cada tentativa de compra no Checkout gera uma chave `idempotencyKey` (`idem_<timestamp>_<random>`) persistida em `sessionStorage` (`kurio_active_checkout_v1`) e enviada no cabeçalho HTTP `Idempotency-Key`.
  - O backend mockado calcula uma impressão digital (`requestFingerprint`) dos itens, quantidades, preços e carteira do pedido:
    - Se a mesma `Idempotency-Key` for reenviada com o **mesmo payload** (ex.: clique duplo ou retry após timeout HTTP `504`), o servidor retorna `200 OK` com a instância original do pedido sem duplicar cobrança nem deduzir estoque duas vezes.
    - Se a mesma chave for reutilizada com payload divergente, retorna `409 IDEMPOTENCY_CONFLICT`.

---

## 7. Decisões de UX e Acessibilidade (WCAG AA)

Para os fluxos exigidos pelas regras de negócio que não possuíam frame dedicado no Figma, foram criados componentes seguindo rigorosamente os tokens de cor (`#140d0a`, `#1b120e`, `#241612`, `#3f2319`, `#d28a4c`, `#e89b55`, `#f5f1eb`) e tipografia (`Space Mono`) do design system Kurio:

- **Modal Contextual de Autenticação (`src/features/auth/auth-modal.tsx`)**: Diálogo acessível (`role="dialog"`, `aria-modal="true"`) com *focus trap*, fechamento por `Escape`, alternância entre Login e Cadastro e botões de preenchimento rápido para as contas de demonstração.
- **Tela de Recibo Confirmado (`src/features/checkout/order-confirmation-page.tsx`)**: Exibe o snapshot imutável do pedido confirmado (`txHash`, rede, provedor de carteira, itens comprados e totais congelados no momento da compra).
- **Drawer de Filtros Mobile e Barra de Navegação Inferior**: Em telas `< 768px`, os filtros laterais tornam-se um modal deslizante acionado pelo botão `Filtros`, e a navegação principal fica acessível na barra fixa inferior.
- **Skeletons com Shimmer e `prefers-reduced-motion` (`src/components/ui/skeleton.tsx`)**: Estados de carregamento preservam a geometria exata dos cards, detalhes, carrinho e perfil (prevenindo *Cumulative Layout Shift* — `CLS = 0`), com animação *shimmer* desativada automaticamente quando o sistema operacional solicita redução de movimento.

---

## 8. Auditoria de Performance e Qualidade (Lighthouse)

A auditoria automatizada (`npm run lighthouse`, implementada em `scripts/run-lighthouse.mjs`) executa **3 rodadas por combinação** (rota × perfil `mobile`/`desktop`) sobre a build de produção (`npm run build && npm run preview`), calculando a **mediana** de cada categoria e salvando os relatórios completos em `lighthouse-reports/`.

### Resultados (Mediana de 3 Execuções)

| Rota | Perfil | Performance (meta ≥ 90) | Accessibility (meta ≥ 95) | Best Practices (meta ≥ 95) | SEO (meta ≥ 90) | LCP | CLS | TBT |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Início (Catálogo)** (`/`) | `mobile` | **93** | **96** | **100** | **92** | 2556 ms | 0 | 107 ms |
| **Início (Catálogo)** (`/`) | `desktop` | **100** | **96** | **100** | **92** | 662 ms | 0 | 2 ms |
| **Detalhes do NFT** (`/nft/emerald-ape-042`) | `mobile` | **94** | **100** | **100** | **92** | 2491 ms | 0 | 78 ms |
| **Detalhes do NFT** (`/nft/emerald-ape-042`) | `desktop` | **100** | **100** | **100** | **92** | 610 ms | 0 | 1 ms |

### Principais Otimizações Aplicadas
- **Code-Splitting de Rotas Secundárias e Diálogos (`src/router.tsx`)**: As rotas de Carrinho, Pagamento, Confirmação de Pedido, Perfil, Carteiras e o modal de Autenticação são carregados sob demanda (`React.lazy`), reduzindo o JavaScript no caminho crítico de `/` e `/nft/$nftId`.
- **Eliminação de Dependências Não Utilizadas do MSW no Bundle (`vite.config.ts`, `src/lib/graphql-stub.ts`)**: Substituição por *stubs* leves dos módulos internos de GraphQL e `tough-cookie`/`tldts` (que o MSW importa mesmo em aplicações puramente REST + Bearer Token), reduzindo mais de 380 KB do bundle de rede.
- **Bypass de Ativos Estáticos no Service Worker (`public/mockServiceWorker.js`)**: O Service Worker do MSW intercepta exclusivamente requisições `/api/*`, permitindo que imagens pré-carregadas (`<link rel="preload" as="image" href="/assets/nfts/ape-emerald.png">`) e chunks estáticos utilizem diretamente o cache nativo do navegador sem *round-trips* extras via `postMessage`.
- **Escalonamento de Tarefas Pós-Hidratação**: A conexão WebSocket (`socketManager.init`) e a busca de itens relacionados na página de detalhes são escalonadas em macrotasks separadas, mantendo o *Total Blocking Time (TBT)* abaixo de 110 ms no perfil mobile e próximo de 0 ms no desktop.

