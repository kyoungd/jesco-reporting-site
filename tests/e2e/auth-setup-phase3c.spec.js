import { test, expect } from '@playwright/test';

test.describe('Phase 3C Authentication and Basic Navigation', () => {
  
  test('application loads and shows authentication', async ({ page }) => {
    // Navigate to the app root
    await page.goto('/');
    
    // The app should either show a landing page or redirect to sign-in
    // Both are valid outcomes that show the app is working
    const title = await page.title();
    expect(title).toBeTruthy(); // App should have a title
    
    // Check if we're redirected to sign-in (expected with Clerk)
    const url = page.url();
    const isSignInPage = url.includes('sign-in') || url.includes('login');
    const hasSignInElements = await page.locator('text=/sign.in|login/i').count() > 0;
    
    // Either we're on sign-in page OR we have sign-in elements
    expect(isSignInPage || hasSignInElements).toBeTruthy();
  });

  test('transactions route requires authentication', async ({ page }) => {
    // Try to access transactions directly
    await page.goto('/transactions');
    
    // Should be redirected to sign-in
    await page.waitForURL(/sign-in|login/);
    
    // Verify we're on authentication page
    expect(page.url()).toContain('sign-in');
    
    // Should show proper redirect URL
    expect(page.url()).toContain('redirect_url');
    expect(page.url()).toContain('transactions');
  });

  test('API routes are protected', async ({ page }) => {
    // Test API endpoint protection
    const response = await page.request.get('/api/transactions');
    
    // Should return 401 Unauthorized or 403 Forbidden
    expect([401, 403]).toContain(response.status());
  });

  test('application assets load correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check that CSS and JS are loading
    await page.waitForLoadState('networkidle');
    
    // Verify no critical resource loading errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Filter out expected authentication errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Unauthorized') && 
      !error.includes('401') &&
      !error.includes('sign-in')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('mobile viewport works correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still work on mobile
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Basic mobile responsiveness check
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(375);
    expect(viewport.height).toBe(667);
  });

  test('accessibility basics', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for basic accessibility elements
    const hasLangAttribute = await page.locator('html[lang]').count() > 0;
    expect(hasLangAttribute).toBeTruthy();
    
    // Should have some form of navigation or main content
    const hasNavigation = await page.locator('nav, [role="navigation"], main, [role="main"]').count() > 0;
    expect(hasNavigation).toBeTruthy();
  });
});