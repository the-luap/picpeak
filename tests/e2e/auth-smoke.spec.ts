import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin!234';
const GALLERY_PASSWORD = process.env.GALLERY_PASSWORD || 'PlaywrightGallery123!';

async function createEventWithPhotos(page: Page) {
  const api = page.request;
  const loginResponse = await api.post('/api/auth/admin/login', {
    data: {
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { token } = await loginResponse.json();
  expect(token).toBeTruthy();

  const eventName = `Playwright Smoke ${Date.now()}`;
  const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const eventResponse = await api.post('/api/admin/events', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      event_type: 'wedding',
      event_name: eventName,
      event_date: eventDate,
      host_name: 'Playwright Host',
      host_email: 'host@example.com',
      admin_email: ADMIN_EMAIL,
      password: GALLERY_PASSWORD,
      expiration_days: 30,
      allow_user_uploads: false,
      allow_downloads: true,
      disable_right_click: false,
      watermark_downloads: false,
    },
  });
  expect(eventResponse.ok()).toBeTruthy();
  const event = await eventResponse.json();

  const imagePath = path.join(process.cwd(), 'test-assets', 'img1.png');
  const buffer = fs.readFileSync(imagePath);
  const uploadResponse = await api.post(`/api/admin/events/${event.id}/upload`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    multipart: {
      photos: {
        name: path.basename(imagePath),
        mimeType: 'image/png',
        buffer,
      },
      category_id: 'individual',
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();

  return {
    event,
    shareLink: event.share_link,
    slug: event.slug,
  };
}

test('admin login and gallery viewing smoke test', async ({ page }) => {
  const { shareLink } = await createEventWithPhotos(page);

  // Admin UI login
  await page.goto('/admin/login');
  const emailField = page.getByLabel(/Email/i);
  if (await emailField.count()) {
    await emailField.fill(ADMIN_EMAIL);
    await page.getByLabel(/Password/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Sign In|Log in/i }).click();
  }
  await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 20000 });

  // Visit gallery share link and authenticate
  await page.goto(shareLink);
  const passwordField = page.getByPlaceholder(/gallery password/i);
  if (await passwordField.count()) {
    try {
      await passwordField.fill(GALLERY_PASSWORD, { timeout: 2000 });
    } catch {
      // Field may disappear if gallery bypasses password; ignore.
    }
  }

  const viewButton = page.getByRole('button', { name: /View Gallery/i });
  if (await viewButton.count()) {
    try {
      await viewButton.click({ noWaitAfter: true, timeout: 2000 });
    } catch {
      // Already inside gallery view.
    }
  }

  // Wait for photos grid to appear
  const tiles = page.locator('.relative.group');
  await expect(tiles.first()).toBeVisible({ timeout: 20000 });

  // Open lightbox to ensure media renders
  await tiles.first().hover();
  await tiles.first().getByRole('button', { name: /View full size/i }).click();
  await expect(page.getByRole('button', { name: /Close/i })).toBeVisible();
});
