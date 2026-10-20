import { test, expect } from '@playwright/test';

test.describe('Kurio NFT Marketplace — Visual Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('site-logo')).toBeVisible();
    await page.evaluate(async () => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      await fetch('/api/__sim__/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedCartWithFigmaItems: true }),
      });
      await fetch('/api/__sim__/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latencyMs: 10,
          jitterMs: 0,
        }),
      });
    });
    await page.reload();
    await expect(page.getByTestId('site-logo')).toBeVisible();
  });

  test('Visual: Início (Home & Catalog)', async ({ page }) => {
    await expect(page.getByTestId('catalog-grid')).toBeVisible();
    await expect(page).toHaveScreenshot('home.png', {
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Visual: Detalhes do NFT', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042');
    await expect(page.getByTestId('nft-detail-title')).toBeVisible();
    await expect(page).toHaveScreenshot('nft-detail.png', {
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Visual: Carrinho de NFTs', async ({ page }) => {
    await page.goto('/carrinho');
    await expect(page.getByTestId('cart-items-list')).toBeVisible();
    await expect(page).toHaveScreenshot('cart.png', {
      maxDiffPixelRatio: 0.03,
    });
  });

  test('Visual: Pagamento (Checkout)', async ({ page }) => {
    // Authenticate as Nova Sato first so /pagamento loads with the Figma seeded cart
    await page.getByTestId('header-login-button').click();
    await page.getByTestId('fill-demo-user-1').click();
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('auth-dialog')).toBeHidden();

    await page.goto('/pagamento');
    await expect(page.getByTestId('checkout-items-summary')).toBeVisible();
    await expect(page).toHaveScreenshot('checkout.png', {
      maxDiffPixelRatio: 0.03,
    });
  });
});
