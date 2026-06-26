import { test, expect } from '@playwright/test';

test.describe('Creator AI Studio', () => {
  test('renders sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proyectos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configuración' })).toBeVisible();
  });

  test('navigates to projects view', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Proyectos' }).click();
    await expect(page.getByText('Tablero Kanban')).toBeVisible({ timeout: 10000 });
  });

  test('settings shows API keys section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Configuración' }).click();
    await expect(page.getByText('Integraciones y API Keys')).toBeVisible();
  });

  test('home dashboard loads without crash', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Buenos días, Ramiro/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir proyecto/i })).toBeVisible();
  });
});
