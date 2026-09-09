import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './helpers/server.mjs';

let ctx;

before(async () => {
  ctx = await startStaticServer();
});

after(async () => {
  await ctx.close();
});

describe('P4-03 browser geo distant coverage', () => {
  it('searches nearest eligible area with coverage context, no dead end', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({ coords: { latitude: 40.7128, longitude: -74.006 } });
      };
    });

    await page.goto(ctx.baseUrl);
    await page.fill('#object-input', 'OBD-II scanner');
    await page.click('#locate-btn');
    await page.waitForSelector('.result-card');

    const status = await page.locator('#status-message').textContent();
    assert.match(status, /closest area we currently cover/i);
    assert.match(status, /Approx\./);
    assert.ok((await page.locator('.result-card').count()) >= 1);
    const zip = await page.locator('#zip-input').inputValue();
    assert.notEqual(zip, '90210');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/workspace/evidence/pass004-mobile-geo-distant.png', fullPage: true });

    await browser.close();
  });
});

describe('P4-01 browser intro copy', () => {
  it('shows trust copy and search ideas without forbidden terms', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(ctx.baseUrl);

    const body = await page.locator('body').innerText();
    assert.doesNotMatch(body, /\bpilot\b|prototype|pass 003|not deployed/i);
    assert.match(body, /Try: sewing machine, telescope/);
    assert.match(body, /We link you to libraries and borrowing resources/);

    await page.screenshot({ path: '/workspace/evidence/pass004-desktop-intro.png', fullPage: true });
    await browser.close();
  });
});

describe('SC-08 browser geolocation denied', () => {
  it('shows denied message and ZIP search still works afterward', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'User denied Geolocation' });
      };
    });

    await page.goto(ctx.baseUrl);
    await page.click('#locate-btn');
    await page.waitForSelector('#status-message:not([hidden])');

    const deniedText = await page.locator('#status-message').textContent();
    assert.match(deniedText, /denied/i);
    assert.match(deniedText, /ZIP/i);

    await page.fill('#object-input', 'sewing machine');
    await page.fill('#zip-input', '16693');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.result-card');

    const resultCount = await page.locator('.result-card').count();
    assert.ok(resultCount >= 1);
    assert.equal(await page.locator('#object-input').inputValue(), 'sewing machine');
    assert.equal(await page.locator('#zip-input').inputValue(), '16693');

    await browser.close();
  });
});

describe('SC-10 browser mobile keyboard accessibility', () => {
  it('has no horizontal overflow at mobile viewport', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(ctx.baseUrl);

    await page.fill('#object-input', 'telescope');
    await page.fill('#zip-input', '01103');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.result-card');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      overflow.scrollWidth <= overflow.clientWidth,
      `horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
    );

    await browser.close();
  });

  it('supports keyboard focus, Enter submit, and CTA reachability', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(ctx.baseUrl);

    await page.focus('#object-input');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'object-input');

    await page.keyboard.type('sewing machine');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'zip-input');

    await page.keyboard.type('16693');
    await page.keyboard.press('Enter');

    await page.waitForSelector('.result-card');
    const cards = page.locator('.result-card');
    assert.ok((await cards.count()) >= 1);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const ctaFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.classList?.contains('result-cta') ?? false;
    });
    assert.ok(ctaFocused, 'result CTA should be keyboard reachable');

    await browser.close();
  });
});
