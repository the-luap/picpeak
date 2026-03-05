import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin!234';

async function getAdminToken(page: import('@playwright/test').Page): Promise<string> {
  const loginRes = await page.request.post('/api/auth/admin/login', {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await loginRes.json();
  return body.token;
}

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/Email|E-Mail/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/Password|Passwort/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Sign In|Log in|Anmelden/i }).click();
  await expect(page.getByRole('heading', { name: /Dashboard|Übersicht/i })).toBeVisible({ timeout: 20000 });
}

test.describe('Upload batch size setting', () => {
  test('setting exists in DB via API with default value 95', async ({ page }) => {
    const token = await getAdminToken(page);

    const res = await page.request.get('/api/admin/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const settings = await res.json();
    expect(settings.general_max_upload_batch_size_mb).toBe(95);
  });

  test('setting appears in General settings UI and can be changed', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'mobile-chrome') {
      test.skip('Settings UI validated on desktop viewport');
    }

    await adminLogin(page);
    await page.goto('/admin/settings');

    // Find the batch size input by its nearby label text
    const batchSizeLabel = page.locator('label', { hasText: /Max Upload Batch Size|Max\. Upload-Paketgröße/i });
    await expect(batchSizeLabel).toBeVisible({ timeout: 10000 });

    // The input is a sibling within the same container
    const batchSizeInput = batchSizeLabel.locator('..').locator('input[type="number"]');
    await expect(batchSizeInput).toBeVisible();
    await expect(batchSizeInput).toHaveValue('95');

    // Change value to 50
    await batchSizeInput.fill('50');

    // Save general settings
    const saveButton = page.getByRole('button', { name: /Save General Settings|Allgemeine Einstellungen speichern/i });
    await saveButton.click();

    // Wait for success toast
    await expect(page.locator('.Toastify__toast').filter({ hasText: /(Settings saved|Einstellungen gespeichert)/i })).toBeVisible({ timeout: 10000 });

    // Reload and verify persisted
    await page.reload();
    const batchSizeLabelAfter = page.locator('label', { hasText: /Max Upload Batch Size|Max\. Upload-Paketgröße/i });
    await expect(batchSizeLabelAfter).toBeVisible({ timeout: 10000 });
    const batchSizeInputAfter = batchSizeLabelAfter.locator('..').locator('input[type="number"]');
    await expect(batchSizeInputAfter).toHaveValue('50');

    // Revert to default
    await batchSizeInputAfter.fill('95');
    await page.getByRole('button', { name: /Save General Settings|Allgemeine Einstellungen speichern/i }).click();
    await expect(page.locator('.Toastify__toast').filter({ hasText: /(Settings saved|Einstellungen gespeichert)/i })).toBeVisible({ timeout: 10000 });
  });

  test('setting is used for upload chunking via API', async ({ page }) => {
    const token = await getAdminToken(page);

    // Set batch size to a small value
    const updateRes = await page.request.put('/api/admin/settings/general', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { general_max_upload_batch_size_mb: 10 },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Verify the setting was saved
    const getRes = await page.request.get('/api/admin/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const settings = await getRes.json();
    expect(settings.general_max_upload_batch_size_mb).toBe(10);

    // Revert to default
    await page.request.put('/api/admin/settings/general', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { general_max_upload_batch_size_mb: 95 },
    });
  });
});
