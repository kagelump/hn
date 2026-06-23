import { test, expect } from '@playwright/test';

test.describe('HN Reader', () => {
  test('home page loads stories', async ({ page }) => {
    await page.goto('/');

    // Wait for stories to load
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Verify story items have expected structure
    const firstStory = page.locator('.page-home .list li').first();
    await expect(firstStory.locator('h3')).toBeVisible();
    await expect(firstStory.locator('.points')).toBeVisible();
    await expect(firstStory.locator('.author')).toBeVisible();
    await expect(firstStory.locator('.comments')).toBeVisible();
  });

  test('clicking comments shows comments page with comment tree', async ({ page }) => {
    await page.goto('/');

    // Wait for stories to load
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Click the first story's comments link
    const commentsLink = page.locator('.page-home .list li .comments').first();
    await commentsLink.click();

    // Comments page should appear
    await expect(page.locator('.page-article-comments')).toHaveClass(/show-page/, { timeout: 15000 });

    // Should show article title
    await expect(page.locator('.page-article-comments .article-header h2')).toBeVisible({ timeout: 15000 });

    // Should show comments list or "no comments" message
    const commentsList = page.locator('.page-article-comments .comments-list');
    const noComments = page.locator('.page-article-comments .no-comments');
    await expect(commentsList.or(noComments)).toBeVisible({ timeout: 30000 });
  });

  test('comments page shows collapse buttons for threads with children', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Click comments on first story (likely has nested comments)
    await page.locator('.page-home .list li .comments').first().click();
    await expect(page.locator('.page-article-comments')).toHaveClass(/show-page/, { timeout: 15000 });

    // Wait for comments to render
    await expect(
      page.locator('.page-article-comments .comments-list, .page-article-comments .no-comments')
    ).toBeVisible({ timeout: 30000 });

    // Check if there are collapse buttons (story might not have nested comments)
    const toggleButtons = page.locator('.page-article-comments .comment-toggle');
    const toggleCount = await toggleButtons.count();

    if (toggleCount > 0) {
      // Verify toggle button shows [-] initially
      const firstToggle = toggleButtons.first();
      await expect(firstToggle).toContainText('[-]');

      // Click to collapse
      await firstToggle.click();

      // Should now show [+]
      await expect(firstToggle).toContainText('[+]');

      // Click to expand
      await firstToggle.click();
      await expect(firstToggle).toContainText('[-]');
    }
  });

  test('settings page loads and allows theme change', async ({ page }) => {
    await page.goto('/');

    // Open submenu by clicking the toggle
    await page.locator('.toggle-submenu').click();
    // Submenu parent should have show-submenu class
    await expect(page.locator('.toggle-submenu').locator('..')).toHaveClass(/show-submenu/, { timeout: 5000 });

    // Click settings
    await page.locator('.show-settings').click();

    // Settings page should appear
    await expect(page.locator('.page-settings')).toHaveClass(/show-page/, { timeout: 5000 });
    await expect(page.locator('.page-settings h1')).toHaveText('Settings');

    // Should have theme selector
    await expect(page.locator('.page-settings [data-theme]')).toHaveCount(2);
    await expect(page.locator('.page-settings [data-font-family]')).toHaveCount(4);
    await expect(page.locator('#hide-read')).toBeVisible();
  });

  test('back navigation works from comments', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Go to comments
    await page.locator('.page-home .list li .comments').first().click();
    await expect(page.locator('.page-article-comments')).toHaveClass(/show-page/, { timeout: 15000 });

    // Click back
    await page.locator('.page-article-comments .back-home').click();

    // Home page should be visible again
    await expect(page.locator('.page-home')).toHaveClass(/show-page/, { timeout: 5000 });
  });

  test('submenu filters work', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Open submenu
    await page.locator('.toggle-submenu').click();
    await expect(page.locator('.toggle-submenu').locator('..')).toHaveClass(/show-submenu/, { timeout: 5000 });

    // Click Ask HN filter
    await page.locator('.filter-ask-hn').click();

    // Should load Ask HN stories (different from front page)
    await page.waitForTimeout(3000); // Wait for new data
    const stories = page.locator('.page-home .list li');
    await expect(stories.first().locator('h3')).toBeVisible({ timeout: 10000 });
  });

  test('reload button refreshes stories', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Click reload
    await page.locator('.reload').click();

    // Stories should still be visible after reload
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });
  });

  test('infinite scroll loads more stories', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Scroll the actual scroll container to the bottom
    await page.locator('.pagebd-container').evaluate(el => el.scrollTop = el.scrollHeight);

    // Wait for more items to load
    await expect(page.locator('.page-home .list li')).toHaveCount(60, { timeout: 15000 });
  });

  test('pull to refresh reloads stories', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Simulate pull-to-refresh via touch
    const container = page.locator('.pagebd-container');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not found');

    const touchStart = { identifier: 0, clientX: box.x + box.width / 2, clientY: box.y + 100 };
    const touchEnd = { identifier: 0, clientX: box.x + box.width / 2, clientY: box.y + 300 };
    await container.dispatchEvent('touchstart', { touches: [touchStart] });
    await container.dispatchEvent('touchmove', { touches: [touchEnd] });
    await container.dispatchEvent('touchend', { changedTouches: [touchEnd] });

    await expect(page.locator('.pull-to-refresh-loading')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });
  });
});
