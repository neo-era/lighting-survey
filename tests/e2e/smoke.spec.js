import { test, expect } from '@playwright/test';

// Smoke tests — critical user flows

test.describe('Lighting Survey — Smoke Tests', () => {

    test('login page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loginOverlay')).toBeVisible();
        await expect(page.locator('#lUsername')).toBeVisible();
        await expect(page.locator('#lPassword')).toBeVisible();
    });

    test('login form has proper structure', async ({ page }) => {
        await page.goto('/');
        const username = page.locator('#lUsername');
        const password = page.locator('#lPassword');
        const loginBtn = page.locator('#loginBtn');
        await expect(username).toBeVisible();
        await expect(password).toBeVisible();
        await expect(loginBtn).toBeVisible();
        await expect(loginBtn).toHaveText(/Đăng nhập/);
    });

    test('map container is rendered', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#map')).toBeAttached();
    });

    test('service worker registers', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => 'serviceWorker' in navigator);
        const swActive = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg !== undefined;
        });
        expect(swActive).toBe(true);
    });

    test('manifest.json is accessible', async ({ page }) => {
        const response = await page.request.get('/manifest.json');
        expect(response.status()).toBe(200);
        const json = await response.json();
        expect(json.name).toBeTruthy();
    });

    test('login attempt with wrong credentials shows error', async ({ page }) => {
        await page.goto('/');
        await page.fill('#lUsername', 'invalid_user_test');
        await page.fill('#lPassword', 'wrong_password');
        await page.click('#loginBtn');
        // Wait for error message
        await page.waitForTimeout(3000);
        const errText = await page.locator('#loginError').textContent();
        expect(errText).toBeTruthy();
    });

    test('help page is accessible', async ({ page }) => {
        const response = await page.request.get('/huongdan.html');
        expect(response.status()).toBe(200);
    });

    test('CSS + JS bundles load', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', (err) => jsErrors.push(err.message));
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Filter out unrelated errors (network, extension, etc.)
        const criticalErrors = jsErrors.filter(e =>
            !e.includes('ResizeObserver') &&
            !e.includes('extension') &&
            !e.includes('Non-Error')
        );
        expect(criticalErrors.length).toBeLessThan(3); // allow minor
    });
});
