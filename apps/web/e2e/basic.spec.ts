import { test, expect } from '@playwright/test';

test.describe('Creator AI Studio', () => {
  test('renders sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proyectos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contenido' })).toBeVisible();
  });

  test('navigates to projects view', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Proyectos' }).click();
    await expect(page.getByText('Tablero Kanban')).toBeVisible({ timeout: 10000 });
  });
});
