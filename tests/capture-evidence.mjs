import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { startStaticServer } from './helpers/server.mjs';

const evidenceDir = join(import.meta.dirname, '..', 'evidence');

const ctx = await startStaticServer();
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(ctx.baseUrl);
await page.screenshot({ path: join(evidenceDir, 'desktop-initial.png'), fullPage: true });

await page.selectOption('#object-input', 'sewing machine');
await page.fill('#zip-input', '16693');
await page.click('button[type="submit"]');
await page.waitForSelector('.result-card');
await page.screenshot({ path: join(evidenceDir, 'desktop-sc01-results.png'), fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(ctx.baseUrl);
await page.fill('#zip-input', '01103');
await page.click('button[type="submit"]');
await page.waitForSelector('.result-card');
await page.screenshot({ path: join(evidenceDir, 'mobile-sc02-results.png'), fullPage: true });

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(ctx.baseUrl);
await page.selectOption('#object-input', 'garden tool');
await page.fill('#zip-input', '65681');
await page.click('button[type="submit"]');
await page.waitForSelector('.result-card');
await page.screenshot({ path: join(evidenceDir, 'pass012-capture-lampe-fallback.png'), fullPage: true });

await browser.close();
await ctx.close();
console.log('Screenshots saved to evidence/');
