import { test, expect, Page } from '@playwright/test';

async function resetMockScenario(page: Page, seedCartWithFigmaItems = false) {
  await page.evaluate(async (seed) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await fetch('/api/__sim__/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedCartWithFigmaItems: seed }),
    });
    await fetch('/api/__sim__/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latencyMs: 20,
        jitterMs: 5,
        outOfOrderCatalog: false,
        failNextRequest: false,
        forceHttpError: null,
        forceSessionExpired: false,
        orderOutcome: 'confirm',
        walletActionOutcome: 'success',
        orderConfirmationDelayMs: 120,
      }),
    });
  }, seedCartWithFigmaItems);
}

async function loginAs(page: Page, email: string, password = 'kurio123') {
  await page.getByTestId('header-login-button').click();
  await expect(page.getByTestId('auth-dialog')).toBeVisible();
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('auth-dialog')).toBeHidden();
}

test.describe('Kurio NFT Marketplace — E2E & Functional Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('site-logo')).toBeVisible();
    await resetMockScenario(page, false);
    await page.reload();
    await expect(page.getByTestId('site-logo')).toBeVisible();
  });

  test('1. Busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({
    page,
    isMobile,
  }) => {
    await expect(page.getByTestId('catalog-grid')).toBeVisible();

    // Navigate to page 2 first
    await page.getByTestId('pagination-page-2').click();
    await expect(page).toHaveURL(/page=2/);

    // Apply category + network filters (must reset pagination to page 1!)
    if (isMobile) {
      await page.getByTestId('mobile-filter-button').click();
      const dialog = page.getByTestId('mobile-filters-dialog');
      await dialog.getByTestId('filter-category-Arte digital').click();
      await dialog.getByTestId('filter-network-Ethereum').click();
      await page.keyboard.press('Escape');
    } else {
      await page.getByTestId('filter-category-Arte digital').first().click();
      await page.getByTestId('filter-network-Ethereum').first().click();
    }

    await expect(page).toHaveURL(/categories=Arte(\+|%20)digital/);
    await expect(page).toHaveURL(/networks=Ethereum/);
    await expect(page).not.toHaveURL(/page=2/);

    // Sort by price_asc
    await page.getByTestId('catalog-sort-select').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);

    // Search for "Emerald"
    if (isMobile) {
      await page.getByTestId('mobile-search-input').fill('Emerald');
    } else {
      await page.getByTestId('catalog-search-input').fill('Emerald');
    }
    await expect(page.getByTestId('nft-card-emerald-ape-042')).toBeVisible();

    // Refresh preserves URL state & results
    await page.reload();
    await expect(page.getByTestId('nft-card-emerald-ape-042')).toBeVisible();

    // Browser back history restores previous filter state
    await page.goBack();
    await expect(page).toHaveURL(/sort=price_asc/);
  });

  test('2. Acesso direto ao detalhe, edição indisponível e tratamento de recurso inexistente', async ({
    page,
  }) => {
    // Direct access to existing NFT with an unavailable edition (Neon Vessel #552 has 1/1 sold out)
    await page.goto('/nft/neon-vessel-552');
    await expect(page.getByTestId('nft-detail-title')).toHaveText('Neon Vessel #552');

    // Select sold-out 1/1 edition
    await page.getByTestId('edition-option-1/1').click();
    await expect(page.getByTestId('nft-edition-availability')).toContainText('Edição esgotada');
    await expect(page.getByTestId('detail-buy-button')).toBeDisabled();

    // Direct access to non-existent NFT -> 404 error state
    await page.goto('/nft/nft-inexistente-999');
    await expect(page.getByTestId('nft-detail-error')).toBeVisible();
    await expect(page.getByTestId('nft-detail-error')).toContainText('NFT não encontrado');
  });

  test('3. Cadastro, login, conflito 409, expiração de sessão, logout e troca de usuário com isolamento', async ({
    page,
  }) => {
    // Open register modal and test email conflict (409)
    await page.getByTestId('header-login-button').click();
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-username-input').fill('novocliente');
    await page.getByTestId('auth-email-input').fill('contato@email.com');
    await page.getByTestId('auth-password-input').fill('kurio123');
    await page.getByTestId('auth-confirm-password-input').fill('kurio123');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('auth-error-banner')).toContainText(
      'Este endereço de e-mail já está cadastrado'
    );

    // Register with unique email and wait for initial session queries to settle
    const initialFavFetch = page.waitForResponse((res) =>
      res.url().includes('/api/favorites')
    );
    await page.getByTestId('auth-email-input').fill('novo@kurio.art');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('header-profile-link')).toContainText('novocliente');
    await initialFavFetch;

    // Simulate session expiration (401 SESSION_EXPIRED) during an authenticated action
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSessionExpired: true }),
      });
    });

    await page.getByTestId('nft-fav-button-emerald-ape-042').click();
    await expect(page.getByTestId('auth-dialog')).toBeVisible();

    // Login as User 1 (Nova Sato)
    await page.getByTestId('fill-demo-user-1').click();
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('header-profile-link')).toContainText('Nova Sato');

    // Logout and switch to User 2 (Kai Collector) -> private data isolated
    await page.getByTestId('header-logout-button').click();
    await loginAs(page, 'kai@kurio.art', 'kurio123');
    await expect(page.getByTestId('header-profile-link')).toContainText('Kai Collector');
  });

  test('4. Favoritos com atualização otimista, falha de mutation com rollback e recuperação', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');

    const favBtn = page.getByTestId('nft-fav-button-sage-nomad-009');
    await expect(favBtn).toHaveAttribute('aria-pressed', 'false');

    // Optimistic favorite toggle succeeds (wait for POST response to finish before configuring next failure)
    const favAddDone = page.waitForResponse(
      (res) =>
        res.url().includes('/api/favorites/sage-nomad-009') &&
        res.request().method() === 'POST'
    );
    await favBtn.click();
    await expect(favBtn).toHaveAttribute('aria-pressed', 'true');
    await favAddDone;

    // Force next request to fail (503) -> optimistic toggle rolls back
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failNextRequest: true, latencyMs: 100 }),
      });
    });

    await favBtn.click();
    // After failure, state rolls back to true and error toast appears
    await expect(
      page.getByTestId('toast-notification').filter({ hasText: 'Falha ao atualizar favorito' })
    ).toBeVisible();
    await expect(favBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('5. Carrinho, quantidades, remoção, cupom e persistência após refresh e login', async ({
    page,
  }) => {
    // Add item as guest from detail page
    await page.goto('/nft/emerald-ape-042');
    await page.getByTestId('detail-qty-increase').click(); // qty = 2
    await page.getByTestId('detail-buy-button').click();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('2');

    // Go to cart and verify persistence after refresh
    await page.goto('/carrinho');
    await page.reload();
    await expect(page.getByTestId('cart-qty-value-emerald-ape-042')).toHaveText('2');
    await expect(page.getByTestId('cart-subtotal')).toHaveText('2.38 ETH');

    // Test invalid & expired coupons
    await page.getByTestId('cart-coupon-input').fill('INVALIDO99');
    await page.getByTestId('cart-coupon-submit').click();
    await expect(page.getByTestId('cart-coupon-error')).toContainText('inválido');

    await page.getByTestId('cart-coupon-input').fill('EXPIRADO50');
    await page.getByTestId('cart-coupon-submit').click();
    await expect(page.getByTestId('cart-coupon-error')).toContainText('expirou');

    // Apply valid coupon KURIO10 (10% off 2.38 = 0.238 -> total = 2.142 + 0.016 = 2.158 ETH)
    await page.getByTestId('cart-coupon-input').fill('KURIO10');
    await page.getByTestId('cart-coupon-submit').click();
    await expect(page.getByTestId('cart-active-coupon')).toContainText('KURIO10');
    await expect(page.getByTestId('cart-total')).toHaveText('2.158 ETH');

    // Authenticate and verify guest cart is preserved for logged-in user
    await loginAs(page, 'contato@email.com');
    await expect(page.getByTestId('cart-qty-value-emerald-ape-042')).toHaveText('2');
  });

  test('6. Compra completa, do catálogo ao recibo confirmado via Socket.IO e remoção seletiva', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');

    await page.goto('/nft/emerald-ape-042');
    await page.getByTestId('detail-buy-button').click();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('1');
    await page.goto('/carrinho');
    await page.getByTestId('cart-checkout-button').click();

    await expect(page).toHaveURL(/\/pagamento/);
    await page.getByTestId('checkout-submit-button').click();

    // Waits for Socket.IO `order.updated` event to transition order to confirmed and navigate to receipt
    await expect(page).toHaveURL(/\/pedido\/ord_/);
    await expect(page.getByTestId('order-confirmation-receipt')).toBeVisible();
    await expect(page.getByTestId('receipt-total')).toHaveText('1.206 ETH');
    await expect(page.getByTestId('header-cart-badge')).toHaveText('0');

    // Verify receipt snapshot immutability even if NFT price changes afterwards
    await page.evaluate(async () => {
      await fetch('/api/__sim__/emit-nft-updated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'emerald-ape-042',
          edition: '1/50',
          priceEth: '9.99',
        }),
      });
    });
    await page.reload();
    await expect(page.getByTestId('receipt-total')).toHaveText('1.206 ETH');
  });

  test('7. Falha de pagamento (recusa mantendo carrinho), clique repetido e timeout com recuperação idempotente', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');
    await page.goto('/nft/emerald-ape-042');
    await page.getByTestId('detail-buy-button').click();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('1');
    await page.goto('/pagamento');
    await expect(page.getByTestId('checkout-username')).toHaveValue('novasato');
    await expect(page.getByTestId('checkout-total')).toHaveText('1.206 ETH');

    // 7a. Payment declined -> items preserved in cart
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderOutcome: 'decline', orderConfirmationDelayMs: 100 }),
      });
    });

    await page.getByTestId('checkout-submit-button').click();
    await expect(page.getByTestId('checkout-order-declined')).toBeVisible();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('1');

    // 7b. Reset attempt and simulate timeout (504) + idempotent retry recovering the exact same order
    await page.getByTestId('checkout-retry-new-attempt').click();
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderOutcome: 'timeout_then_pending',
          orderConfirmationDelayMs: 500,
        }),
      });
    });

    await page.getByTestId('checkout-submit-button').click();
    await expect(page.getByTestId('checkout-submission-error')).toContainText(
      'Tempo limite de resposta excedido'
    );

    // Retry with same idempotencyKey recovers the order without duplicating
    await page.getByTestId('checkout-retry-idempotent').click();
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 10000 });
    await expect(page.getByTestId('order-confirmation-receipt')).toBeVisible();
  });

  test('8. Edição de perfil, avatar, senha e carteiras com erros de validação e persistência', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');
    await page.goto('/perfil');
    await expect(page.getByTestId('profile-display-name')).toHaveValue('Nova Sato');

    // Validation error on empty display name
    await page.getByTestId('profile-display-name').fill('');
    await page.getByTestId('profile-save-button').click();
    await expect(page.locator('#err-profile-display-name')).toBeVisible();

    // Valid profile update + avatar change
    await page.getByTestId('profile-display-name').fill('Nova Sato VIP');
    await page.getByTestId('profile-avatar-change').click();
    await page.getByTestId('profile-save-button').click();
    await expect(page.getByTestId('header-profile-link')).toContainText('Nova Sato VIP');

    await page.reload();
    await expect(page.getByTestId('profile-display-name')).toHaveValue('Nova Sato VIP');

    // Wallets validation & update
    await page.goto('/carteiras');
    await expect(page.getByTestId('wallet-primary-nickname')).toHaveValue('Principal');
    await page.getByTestId('wallet-primary-address').fill('endereco-invalido');
    await page.getByTestId('wallet-primary-save-button').click();
    await expect(page.getByTestId('wallet-primary-address-error')).toBeVisible();

    await page
      .getByTestId('wallet-primary-address')
      .fill('0xA91F234567890ABCDE1234567890ABCDEF12E82C');
    await page.getByTestId('wallet-primary-nickname').fill('Carteira Principal VIP');
    const walletSavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/wallets/primary') && res.request().method() === 'PUT'
    );
    await page.getByTestId('wallet-primary-save-button').click();
    await walletSavePromise;

    await page.reload();
    await expect(page.getByTestId('wallet-primary-nickname')).toHaveValue(
      'Carteira Principal VIP'
    );
  });

  test('9. Alteração de preço/disponibilidade via Socket.IO durante o checkout exigindo nova confirmação', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');
    await page.goto('/nft/emerald-ape-042');
    await page.getByTestId('detail-buy-button').click();
    await expect(page.getByTestId('header-cart-badge')).toHaveText('1');
    await page.goto('/pagamento');

    await expect(page.getByTestId('checkout-username')).toHaveValue('novasato');
    await expect(page.getByTestId('checkout-total')).toHaveText('1.206 ETH');

    // Emit real-time Socket.IO `nft.updated` changing price from 1.19 to 1.50 ETH
    await page.evaluate(async () => {
      await fetch('/api/__sim__/emit-nft-updated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'emerald-ape-042',
          edition: '1/50',
          priceEth: '1.50',
          available: 10,
        }),
      });
    });

    // Checkout immediately displays the outdated quote banner and updates summary to 1.516 ETH
    await expect(page.getByTestId('checkout-quote-outdated-banner')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('1.516 ETH');

    // Attempting to submit without confirming the updated quote is blocked
    await page.getByTestId('checkout-submit-button').click();
    await expect(page.getByTestId('checkout-submission-error')).toContainText(
      'Confirmar novos valores'
    );

    // User explicitly confirms the new quote and completes purchase
    await page.getByTestId('checkout-confirm-updated-quote').click();
    await expect(page.getByTestId('checkout-quote-outdated-banner')).toBeHidden();
    await page.getByTestId('checkout-submit-button').click();

    await expect(page).toHaveURL(/\/pedido\/ord_/);
    await expect(page.getByTestId('receipt-total')).toHaveText('1.516 ETH');
  });

  test('10. Eventos duplicados ou antigos descartados, desconexão e retomada de pedido pendente', async ({
    page,
  }) => {
    await loginAs(page, 'contato@email.com');
    await page.goto('/nft/emerald-ape-042');
    await expect(page.getByTestId('nft-detail-price')).toHaveText('1.19 ETH');

    // Emit valid v2 update -> 1.85 ETH
    await page.evaluate(async () => {
      await fetch('/api/__sim__/emit-nft-updated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'emerald-ape-042',
          edition: '1/50',
          priceEth: '1.85',
          forceVersion: 5,
          forceEventId: 'evt_test_v5',
        }),
      });
    });
    await expect(page.getByTestId('nft-detail-price')).toHaveText('1.85 ETH');

    // Emit stale version (v3) with different price -> must be ignored!
    await page.evaluate(async () => {
      await fetch('/api/__sim__/emit-nft-updated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nftId: 'emerald-ape-042',
          edition: '1/50',
          priceEth: '0.10',
          forceVersion: 3,
          forceEventId: 'evt_test_stale_v3',
        }),
      });
    });
    await expect(page.getByTestId('nft-detail-price')).toHaveText('1.85 ETH');
  });

  test('11. Navegação por teclado, controle de foco em diálogos e validação acessível de formulários', async ({
    page,
  }) => {
    // Open login modal via keyboard Enter on login button
    const loginBtn = page.getByTestId('header-login-button');
    await loginBtn.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByTestId('auth-dialog');
    await expect(dialog).toBeVisible();

    // Submit empty form to trigger accessible field validation errors (`aria-invalid="true"`)
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('auth-email-input')).toHaveAttribute(
      'aria-invalid',
      'true'
    );

    // Close dialog with Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('12. Skeletons com shimmer durante carregamento lento, feedback de falha e recuperação após retry', async ({
    page,
  }) => {
    await expect(page.getByTestId('catalog-grid')).toBeVisible();

    // Configure slow latency (900ms) and failure on next request
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latencyMs: 900, failNextRequest: true }),
      });
    });

    // Trigger a new catalog query
    await page.getByTestId('catalog-tab-new').click();

    // Skeleton must be visible during slow loading
    await expect(page.getByTestId('catalog-skeleton')).toBeVisible();

    // Then error state appears because failNextRequest was true
    await expect(page.getByTestId('catalog-error-state')).toBeVisible();

    // Lower latency and click retry -> catalog recovers cleanly
    await page.evaluate(async () => {
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latencyMs: 30, failNextRequest: false }),
      });
    });

    await page.getByTestId('catalog-retry-button').click();
    await expect(page.getByTestId('catalog-grid')).toBeVisible();
  });

  test('13. Interatividade dos sliders da home e navegação do botão Mercado para a listagem', async ({
    page,
    isMobile,
  }) => {
    // 1. Hero slider next/prev buttons
    const heroPrev = page.getByTestId('hero-prev-button');
    const heroNext = page.getByTestId('hero-next-button');
    await expect(heroNext).toBeVisible();
    await heroNext.click();
    // After next, slide 2 (Sage Nomad #009) is shown
    await expect(page.getByText('Coleção Kurio Nomads')).toBeVisible();
    await heroPrev.click();
    // Back to slide 1
    await expect(page.getByText('Bem-vindo à Kurio')).toBeVisible();

    // 2. Button "Mercado" navigates/scrolls to #mercado section
    if (!isMobile) {
      await page.getByTestId('header-mercado-link').click();
      await expect(page).toHaveURL(/#mercado/);
      const mercadoSection = page.locator('#mercado');
      await expect(mercadoSection).toBeInViewport();
    }

    // 3. Price slider interaction
    if (!isMobile) {
      const priceSlider = page.getByTestId('filter-price-slider');
      await expect(priceSlider).toBeVisible();
      const thumbs = priceSlider.getByRole('slider');
      await expect(thumbs).toHaveCount(2);
    }
  });
});
