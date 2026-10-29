import { test, expect } from '@playwright/test';

async function checkParcel(page, dimensions, weight) {
  for (const [index, name] of ['length', 'width', 'height'].entries()) {
    await page.locator(`#parcel-${name}`).fill(String(dimensions[index]));
  }
  await page.locator('#parcel-weight').fill(String(weight));
  await page.getByRole('button', { name: 'Check parcel size', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/uk-parcel-size-checker/');
});

// Independent fixtures transcribed from the Royal Mail October 2026 online guide,
// pages 5–6. These catch ignoring weight or reusing the cheapest format price.
const cases = [
  { name: 'Letter at 100g', dimensions: [24, 16.5, 0.5], weight: 0.1, format: 'Letter', prices: [1.80, 0.91] },
  { name: 'Letter dimensions over 100g', dimensions: [24, 16.5, 0.5], weight: 0.101, format: 'Large Letter', prices: [3.30, 1.90, 3.90, 2.90] },
  { name: 'Large Letter at 100g', dimensions: [35.3, 25, 2.5], weight: 0.1, format: 'Large Letter', prices: [3.20, 1.55, 3.90, 2.90] },
  { name: 'Large Letter at 250g', dimensions: [35.3, 25, 2.5], weight: 0.25, format: 'Large Letter', prices: [3.30, 1.90, 3.90, 2.90] },
  { name: 'Large Letter above 250g', dimensions: [35.3, 25, 2.5], weight: 0.251, format: 'Large Letter', prices: [3.30, 2.40, 3.90, 2.90] },
  { name: 'Large Letter at 500g', dimensions: [35.3, 25, 2.5], weight: 0.5, format: 'Large Letter', prices: [3.30, 2.40, 3.90, 2.90] },
  { name: 'Large Letter above 500g', dimensions: [35.3, 25, 2.5], weight: 0.501, format: 'Large Letter', prices: [3.30, 2.70, 3.90, 2.90] },
  { name: 'Large Letter at 750g', dimensions: [35.3, 25, 2.5], weight: 0.75, format: 'Large Letter', prices: [3.30, 2.70, 3.90, 2.90] },
  { name: 'tracked-only above 750g', dimensions: [35.3, 25, 2.5], weight: 0.751, format: 'Large Letter (Tracked only)', prices: [null, null, 3.90, 2.90] },
  { name: 'tracked-only at 1kg', dimensions: [35.3, 25, 2.5], weight: 1, format: 'Large Letter (Tracked only)', prices: [null, null, 3.90, 2.90] },
  { name: 'Large Letter dimensions over 1kg', dimensions: [35.3, 25, 2.5], weight: 1.001, format: 'Small Parcel', prices: [5.70, 4.40, 4.80, 3.75] },
  { name: 'rotated Small Parcel at 2kg', dimensions: [16, 45, 35], weight: 2, format: 'Small Parcel', prices: [5.70, 4.40, 4.80, 3.75] },
  { name: 'Medium Parcel at 2kg', dimensions: [61, 46, 46], weight: 2, format: 'Medium Parcel', prices: [8.20, 7.00, 6.75, 5.70] },
  { name: 'Small Parcel dimensions over 2kg', dimensions: [45, 35, 16], weight: 2.001, format: 'Medium Parcel', prices: [10.40, 9.00, 8.80, 7.55] },
  { name: 'Medium Parcel at 10kg', dimensions: [61, 46, 46], weight: 10, format: 'Medium Parcel', prices: [10.40, 9.00, 8.80, 7.55] },
  { name: 'Medium Parcel over 10kg', dimensions: [61, 46, 46], weight: 10.001, format: 'Medium Parcel', prices: [16.40, 13.70, 14.30, 12.25] },
  { name: 'Medium Parcel at 20kg', dimensions: [61, 46, 46], weight: 20, format: 'Medium Parcel', prices: [16.40, 13.70, 14.30, 12.25] },
];

for (const scenario of cases) {
  test(`October online tariff: ${scenario.name}`, async ({ page }) => {
    await checkParcel(page, scenario.dimensions, scenario.weight);
    const results = page.locator('#parcel-results');
    await expect(results.locator('.result-item').filter({ has: page.getByText('Royal Mail format', { exact: true }) }).locator('dd')).toHaveText(scenario.format);
    for (const [index, service] of ['1st Class', '2nd Class', 'Tracked 24', 'Tracked 48'].entries()) {
      const option = results.locator('.postage-option').filter({ has: page.getByRole('heading', { name: `Royal Mail ${service}`, exact: true }) });
      const price = scenario.prices[index];
      if (price == null) await expect(option).toHaveCount(0);
      else await expect(option.locator('strong')).toContainText(`£${price.toFixed(2)}`);
    }
  });
}

test('rejects invalid inputs and excludes overweight or oversized Royal Mail parcels', async ({ page }) => {
  await checkParcel(page, [30, 20, 8], 0);
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  for (const [dimensions, weight] of [[[61, 46, 46], 20.001], [[61.1, 46, 46], 2]]) {
    await checkParcel(page, dimensions, weight);
    await expect(page.locator('#parcel-results .postage-option').filter({ has: page.getByRole('heading', { name: 'Royal Mail standard formats' }) })).toContainText('Not eligible');
    await expect(page.locator('#parcel-results').getByRole('heading', { name: 'Royal Mail Tracked 48' })).toHaveCount(0);
  }
});

test('dates carriers separately and fits a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await checkParcel(page, [30, 20, 8], 1);
  await expect(page.locator('#parcel-results')).toContainText('29 October 2026');
  await expect(page.locator('#parcel-results')).toContainText('5 October 2026');
  await expect(page.locator('#parcel-results')).toContainText('9 June 2026');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
