import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/ebay-profit-calculator-uk/');
});

function result(page, label) {
  return page.locator('#profit-results dl > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
}

async function example(page, category = 'clothes') {
  await page.locator('#ebay-category').selectOption(category);
  await page.locator('#product-cost').fill('5');
  await page.locator('#selling-price').fill('10');
}

test('£5 cost and £10 sale match the supplied 11.9% fee example including VAT', async ({ page }) => {
  await example(page);
  await expect(result(page, 'Estimated profit')).toHaveText('£3.16');
  for (const [label, value] of [
    ['Profit margin', '31.6%'], ['ROI on total costs', '46.2%'], ['Total revenue', '£10.00'], ['Total costs', '£6.84'],
    ['Final value fee', '£1.19'], ['Per-order fixed fee', '£0.30'], ['Regulatory operating fee (0.35%)', '£0.04'],
    ['VAT on marketplace fees (20%)', '£0.31'], ['Total eBay fees', '£1.84'], ['HMRC VAT due', '£0.00'],
    ['Item cost', '£5.00'], ['Actual postage', '£0.00'], ['Packaging', '£0.00'], ['Other/listing costs', '£0.00'],
  ]) await expect(result(page, label)).toHaveText(value);
  await expect(page.locator('#profit-results')).toContainText('Not VAT registered');
  await expect(result(page, 'Break-even selling price')).toHaveText('£6.28');
  await expect(result(page, 'Price for £5.00 target profit')).toHaveText('£12.28');
});

test('postage, promotion VAT and item costs all contribute once to the breakdown', async ({ page }) => {
  await example(page);
  await page.locator('#postage-charged').fill('2');
  await page.locator('#actual-postage').fill('2');
  await page.locator('#packaging-cost').fill('0.5');
  await page.locator('#other-costs').fill('0.5');
  await page.locator('#promoted-percentage').fill('2');
  for (const [label, value] of [
    ['Total revenue', '£12.00'], ['Final value fee', '£1.43'], ['Per-order fixed fee', '£0.40'],
    ['Promoted listing fee', '£0.24'], ['VAT on marketplace fees (20%)', '£0.42'],
    ['Total eBay fees', '£2.53'], ['Total costs', '£10.53'], ['Estimated profit', '£1.47'],
  ]) await expect(result(page, label)).toHaveText(value);
});

test('order thresholds and category exceptions keep their fee rules with VAT', async ({ page }) => {
  await example(page);
  await page.locator('#selling-price').fill('10.01');
  await expect(result(page, 'Per-order fixed fee')).toHaveText('£0.40');
  await expect(result(page, 'VAT on marketplace fees (20%)')).toHaveText('£0.33');
  await expect(result(page, 'Estimated profit')).toHaveText('£3.05');
  await page.locator('#ebay-category').selectOption('home');
  await page.locator('#selling-price').fill('10');
  await expect(result(page, 'Per-order fixed fee')).toHaveText('£0.10');
  await expect(result(page, 'Total eBay fees')).toHaveText('£1.60');
  await page.locator('#selling-price').fill('600');
  await expect(result(page, 'Final value fee')).toHaveText('£67.40');
  await expect(result(page, 'VAT on marketplace fees (20%)')).toHaveText('£13.98');
  await expect(result(page, 'Total eBay fees')).toHaveText('£83.88');
});

test('break-even and target recommendations cover VAT and achieve the displayed goals', async ({ page }) => {
  await example(page);
  await page.locator('#selling-price').fill('6.28');
  await expect(result(page, 'Estimated profit')).toHaveText('£0.00');
  await page.locator('#selling-price').fill('6.27');
  await expect(result(page, 'Estimated profit')).toHaveText('-£0.01');
  await page.locator('#selling-price').fill('12.28');
  await expect(result(page, 'Estimated profit')).toHaveText('£5.00');
  await page.locator('#selling-price').fill('12.27');
  await expect(result(page, 'Estimated profit')).toHaveText('£4.99');
  await page.locator('#product-cost').fill('8.16');
  // At £9.98 the regulatory fee rounds to 3p and VAT to 30p: fees £1.82.
  await expect(result(page, 'Break-even selling price')).toHaveText('£9.98');
  await page.locator('#selling-price').fill('9.98');
  await expect(result(page, 'Estimated profit')).toHaveText('£0.00');
  await page.locator('#selling-price').fill('9.97');
  await expect(result(page, 'Estimated profit')).toHaveText('-£0.01');
  await page.locator('#selling-price').fill('10.01');
  await expect(result(page, 'Estimated profit')).toHaveText('-£0.11');
});

test('validates rates including VAT, preserves reset, and fits a narrow screen', async ({ page }) => {
  await example(page);
  await page.locator('#promoted-percentage').fill('75');
  await expect(page.getByRole('alert')).toContainText('VAT');
  await page.locator('#promoted-percentage').fill('0');
  await page.locator('#product-cost').fill('-1');
  await expect(page.getByRole('alert')).toContainText('zero or more');
  await page.locator('#product-cost').fill('5');
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/profit-320.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#profit-results').screenshot({ path: 'test-results/profit-1280.png' });
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#ebay-category')).toHaveValue('');
  await expect(page.locator('#selling-price')).toHaveValue('');
  await expect(page.locator('#profit-results')).toContainText('Choose the closest eBay category');
});

test('price recommendations find the first valid penny despite VAT rounding dips', async ({ page }) => {
  await example(page);
  await page.locator('#product-cost').fill('8.17');
  await expect(result(page, 'Break-even selling price')).toHaveText('£9.99');
  await page.locator('#selling-price').fill('9.99');
  await expect(result(page, 'Estimated profit')).toHaveText('£0.00');
  await page.locator('#selling-price').fill('10');
  await expect(result(page, 'Estimated profit')).toHaveText('-£0.01');
  await page.locator('#product-cost').fill('5.06');
  await expect(result(page, 'Break-even selling price')).toHaveText('£6.34');
  await page.locator('#selling-price').fill('6.34');
  await expect(result(page, 'Estimated profit')).toHaveText('£0.00');
  await page.locator('#selling-price').fill('6.35');
  await expect(result(page, 'Estimated profit')).toHaveText('-£0.01');
  await page.locator('#product-cost').fill('5');
  await page.locator('#target-profit').fill('3.17');
  await expect(result(page, 'Price for £3.17 target profit')).toHaveText('£9.99');
});
