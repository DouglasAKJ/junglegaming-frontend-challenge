# Kurio — Marketplace de Arte Digital & NFTs

Implementação completa do desafio **Kurio NFT Marketplace**, construída com foco em fidelidade visual ao Figma (desktop e mobile), arquitetura de rede realista com **MSW (REST + Socket.IO)**, precisão financeira em **ETH** (`decimal.js`), resiliência a concorrência, acessibilidade (**WCAG AA**) e suíte automatizada de testes **Playwright** (E2E + Regressão Visual) e **Lighthouse**.

---

## Sumário

1. [Stack Tecnológica](#1-stack-tecnológica)
2. [Requisitos e Instalação](#2-requisitos-e-instalação)
3. [Variáveis de Ambiente](#3-variáveis-de-ambiente)
4. [Comandos Disponíveis](#4-comandos-disponíveis)
5. [Credenciais Fictícias e Cupons de Teste](#5-credenciais-fictícias-e-cupons-de-teste)
6. [Simulador de Rede, Falhas e Socket.IO (E2E & DevTools)](#6-simulador-de-rede-falhas-e-socketio-e2e--devtools)
7. [Como Testar os Fluxos Principais e Cenários de Falha](#7-como-testar-os-fluxos-principais-e-cenários-de-falha)
8. [Testes Automatizados (Playwright E2E & Visual) e Lighthouse](#8-testes-automatizados-playwright-e2e--visual-e-lighthouse)

---

## 1. Stack Tecnológica

- **Core**: React 19 + TypeScript + Vite 6
- **Roteamento**: TanStack Router (`@tanstack/react-router`) com sincronização bidirecional de query params na URL (`q`, `categories`, `networks`, `minPrice`, `maxPrice`, `tab`, `sort`, `page`)
- **Gerenciamento de Estado Assíncrono & Cache**: TanStack Query v5 (`@tanstack/react-query`) com isolamento de chaves por usuário e cancelamento via `AbortSignal`
- **Comunicação HTTP**: Axios (`src/lib/api.ts`) com suporte a `Idempotency-Key`, normalização de erros (`AppApiError`) e interceptação de expiração de sessão (`401 SESSION_EXPIRED`)
- **Tempo Real**: Socket.IO Client (`socket.io-client`) com deduplicação por `eventId`, controle de versão monotônica (`version`), proteção de estados terminais e reconciliação automática pós-reconexão
- **Camada Mock de Rede**: MSW v2 (`msw/browser` + `@mswjs/socket.io-binding`) interceptando tráfego HTTP e WebSocket diretamente no navegador (ativo tanto em `dev` quanto em `build`/`preview`)
- **Matemática Financeira**: `decimal.js` (`src/lib/eth.ts`) eliminando erros de ponto flutuante IEEE 754 em cálculos de subtotais, descontos percentuais e taxas de rede (`ETH`)
- **Estilização & UI**: Tailwind CSS v4 + componentes acessíveis inspirados em `shadcn/ui` (`Dialog`, `Toast`, `Skeleton` com shimmer e suporte a `prefers-reduced-motion`)
- **Qualidade & Auditoria**: Playwright (`@playwright/test`) para testes E2E e regressão visual em `desktop-chromium` e `mobile-chromium`, e Lighthouse (`lighthouse`)

---

## 2. Requisitos e Instalação

- **Node.js**: v20+ recomendado
- **Gerenciador de pacotes**: `npm`

```bash
# 1. Instalar dependências
npm install

# 2. (Opcional) Instalar navegador Chromium do Playwright caso ainda não esteja instalado
npx playwright install chromium

# 3. Iniciar ambiente de desenvolvimento (http://localhost:5173)
npm run dev
```

---

## 3. Variáveis de Ambiente

A aplicação funciona **out-of-the-box sem necessidade de criar arquivo `.env`**, pois o MSW é inicializado automaticamente em `src/main.tsx` tanto em desenvolvimento quanto em preview/produção para garantir que os testes E2E, visuais e auditorias Lighthouse rodem sobre a build real.

Caso deseje customizar parâmetros opcionais:

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `LH_BASE_URL` | `http://localhost:4173` | URL base utilizada pelo script de auditoria Lighthouse (`npm run lighthouse`) |
| `LH_RUNS` | `3` | Número de execuções por rota/perfil para cálculo da mediana no Lighthouse |
| `CI` | `false` | Controla paralelismo e retries na suíte Playwright |

---

## 4. Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite em `http://localhost:5173` |
| `npm run build` | Executa checagem de tipos (`tsc -b`) e gera a build de produção em `dist/` |
| `npm run preview` | Serve a build de produção localmente (ex.: `npm run preview -- --port 4173`) |
| `npm run typecheck` | Valida a tipagem estática TypeScript sem emitir arquivos (`tsc --noEmit`) |
| `npm run lint` | Executa verificação estática de código com ESLint |
| `npm run test:e2e` | Executa toda a suíte Playwright (24 testes funcionais E2E + 8 snapshots visuais em Desktop e Mobile) |
| `npm run test:e2e:ui` | Abre a interface interativa do Playwright para inspeção passo a passo |
| `npm run lighthouse` | Executa 3 rodadas de auditoria Lighthouse para Início e Detalhes do NFT em `mobile` e `desktop` e salva os relatórios em `lighthouse-reports/` |

---

## 5. Credenciais Fictícias e Cupons de Teste

### Contas de Colecionadores Pré-cadastradas

Você pode preencher rapidamente essas credenciais diretamente no modal de Login clicando nos botões de atalho **"Demo: Nova Sato"** ou **"Demo: Kai Collector"**:

| Colecionador | E-mail | Senha | Nome de Usuário | ENS | Carteiras Cadastradas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nova Sato** | `contato@email.com` | `kurio123` | `novasato` | `nova.kurio.eth` | Principal (Ethereum / MetaMask) + Reserva (Polygon / Coinbase) |
| **Kai Collector** | `kai@kurio.art` | `kurio123` | `kaicollector` | `kai.vault.eth` | Vault Principal (Ethereum / WalletConnect) |

> Também é possível criar uma nova conta a qualquer momento pela aba **Criar conta** no modal de autenticação.

### Cupons Promocionais de Teste

| Código | Desconto | Status | Comportamento Esperado |
| :--- | :---: | :--- | :--- |
| `KURIO10` | **10%** | Válido | Aplica 10% de desconto sobre o subtotal dos NFTs |
| `GREEN20` | **20%** | Válido | Aplica 20% de desconto VIP sobre o subtotal dos NFTs |
| `EXPIRADO50` | 50% | **Expirado** | Retorna erro `400 VALIDATION_ERROR` informando que o cupom expirou |
| Qualquer outro (ex.: `INVALIDO`) | — | **Inválido** | Retorna erro `400 VALIDATION_ERROR` informando código não encontrado |

---

## 6. Simulador de Rede, Falhas e Socket.IO (E2E & DevTools)

No canto inferior direito da tela há o botão flutuante **`Simulador MSW / WS`** (`data-testid="sim-devtools-toggle"`). Ele permite controlar em tempo real o comportamento do backend mockado sem precisar editar código:

- **Latência de Rede (`latencyMs`)**: Ajustável de `0ms` a `2000ms` para inspecionar os *skeletons* com efeito *shimmer* e estados de carregamento.
- **Respostas Fora de Ordem no Catálogo (`outOfOrderCatalog`)**: Atraso proposital em buscas curtas para comprovar que o cancelamento por `AbortSignal` e as chaves do TanStack Query impedem que respostas antigas sobrescrevam resultados mais novos.
- **Falhar Próxima Requisição HTTP (`failNextRequest`)**: Força erro `503 Service Unavailable` na próxima chamada REST para testar banners de erro e botões de **"Tentar novamente"**.
- **Forçar Sessão Expirada (`forceSessionExpired`)**: Faz com que rotas privadas retornem `401 SESSION_EXPIRED`, abrindo o modal de reautenticação preservando a rota e a intenção do usuário.
- **Desfecho do Pedido no Checkout (`orderOutcome`)**:
  - `Confirmar via Socket.IO (Padrão)`: Cria o pedido como `pending` e emite evento `order.updated` (`status: 'confirmed'`) após alguns milissegundos.
  - `Recusar pagamento (Mantém carrinho)`: Emite `order.updated` (`status: 'declined'`), exibindo o motivo da recusa no Checkout e preservando os itens no carrinho.
  - `Timeout HTTP 504 + Recuperação Idempotente`: Simula falha de timeout na primeira submissão enquanto o pedido é registrado; ao clicar em **"Tentar novamente com mesma chave"**, a requisição reutiliza o cabeçalho `Idempotency-Key` e recupera o mesmo pedido sem duplicar cobrança.
- **Gatilhos Socket.IO Instantâneos**:
  - Emitir `nft.updated` alterando o preço de `Emerald Ape #042` para `1.65 ETH`.
  - Emitir `nft.updated` reduzindo o estoque disponível de `Emerald Ape #042` para `1` unidade.
  - Forçar desconexão e reconexão do WebSocket (`disconnect-sockets`) para validar a reconciliação automática via REST.

### Como Restaurar o Estado Inicial

Você pode restaurar o banco de dados mockado (`localStorage` sob a chave `kurio_mock_db_v1`) de três maneiras:
1. Clicando em **"Restaurar Estado Inicial (Limpo)"** dentro do painel `Simulador MSW / WS`.
2. Clicando em **"Popular Carrinho Igual ao Figma (3 itens)"** dentro do painel `Simulador MSW / WS` (popula o carrinho exatamente com os 3 itens e totais de `26.83 ETH` / `26.846 ETH` do layout Figma).
3. Via console do navegador: `localStorage.clear(); sessionStorage.clear(); location.reload();`.

---

## 7. Como Testar os Fluxos Principais e Cenários de Falha

1. **Catálogo, Busca, Filtros e Sincronização com URL (`/`)**:
   - Digite um termo na busca (ex.: `Emerald`), selecione categorias (`Arte digital`, `Música`), redes (`Ethereum`, `Polygon`), faixa de preço (`Min`/`Max`), abas (`Todos`, `Lançamentos`, `Em alta`), ordenação e paginação.
   - Observe a atualização imediata dos parâmetros na URL e use os botões **Voltar/Avançar** do navegador ou recarregue a página (`F5`) para confirmar a restauração exata do estado.
2. **Detalhes do NFT e Variação por Edição (`/nft/emerald-ape-042`)**:
   - Alterne entre as edições `1/1`, `1/10`, `1/50` e `ABERTA` para ver a atualização instantânea do preço unitário em `ETH` e da quantidade disponível em estoque.
   - Teste a galeria de miniaturas, o acordeão **"Descrição completa"** e a tentativa de favoritar deslogado (abre o modal de login e conclui a ação ao autenticar).
3. **Carrinho e Reconciliação em Tempo Real (`/carrinho`)**:
   - Adicione itens, altere quantidades respeitando o limite de estoque e aplique o cupom `KURIO10`.
   - Abra o **Simulador MSW / WS** e dispare **"Alterar Preço Emerald Ape (1.65 ETH)"**: um aviso em tempo real aparece no item afetado e no topo da página com os valores recalibrados.
4. **Checkout, Idempotência e Confirmação Real (`/pagamento` -> `/pedido/:orderId`)**:
   - Preencha ou selecione uma carteira cadastrada, teste os botões de simulação de carteira (**Simular Conexão**, **Simular Recusa**, **Simular Desconexão**) e clique em **Confirmar compra**.
   - A tela aguarda a confirmação assíncrona (`pending` -> `confirmed` via Socket.IO) antes de redirecionar para o recibo imutável em `/pedido/:orderId`, limpando apenas os itens comprados do carrinho.
5. **Perfil e Carteiras (`/perfil` e `/carteiras`)**:
   - Edite dados do colecionador, alterne o avatar, valide a troca de senha (incluindo erro de senha atual incorreta) e gerencie as carteiras **Principal** e **Secundária** com persistência após refresh.

---

## 8. Testes Automatizados (Playwright E2E & Visual) e Lighthouse

Para executar a verificação completa sobre a build de produção:

```bash
# 1. Compilar para produção e rodar os 32 testes Playwright (Desktop + Mobile)
npm run build
npm run test:e2e

# 2. Executar a auditoria Lighthouse (3 execuções por rota/perfil com cálculo de mediana)
npm run lighthouse
```

Os relatórios detalhados em HTML, JSON e Markdown do Lighthouse são gerados no diretório [`lighthouse-reports/`](file:///home/pougos/projects/junglegaming/frontend-challenge/lighthouse-reports/SUMMARY.md), e a documentação arquitetural completa encontra-se em [`ARCHITECTURE.md`](file:///home/pougos/projects/junglegaming/frontend-challenge/ARCHITECTURE.md).
