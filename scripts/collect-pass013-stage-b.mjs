/**
 * Production evidence collector for Pass 013 Stage B.
 * Hits the live Pass-012 site only. Does not mutate product files.
 * Local timings are observational and do not predict internet latency.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.cibt', 'pass-013', 'evidence', 'stage-b');
const PRODUCTION_URL = 'https://caniborrowthis.com/';

const CASES = [
  {
    id: 'initial_page',
    class: 'initial_page',
    zip: null,
    geo: false,
  },
  {
    id: 'exact_outlet_zip_01001',
    class: 'exact-outlet national ZIP',
    zip: '01001',
    object: 'telescope',
  },
  {
    id: 'zcta_nearest_zip_00601',
    class: 'ZCTA-nearest ZIP',
    zip: '00601',
    object: 'telescope',
  },
  {
    id: 'indirect_only_zip_96801',
    class: 'indirect-only ZIP',
    zip: '96801',
    object: 'telescope',
  },
  {
    id: 'unknown_zip_99999',
    class: 'unknown well-formed ZIP',
    zip: '99999',
    object: 'telescope',
  },
  {
    id: 'geo_national_nyc_chainsaw',
    class: 'GEO national search',
    geo: { lat: 40.7589, lon: -73.9851 },
    object: 'chainsaw',
  },
  {
    id: 'mobile_exact_outlet_01001',
    class: 'mobile practicality',
    zip: '01001',
    object: 'telescope',
    mobile: true,
  },
];

function nationalJsonUrls(urls) {
  return urls.filter((url) => /\/js\/national\/.*\.json(?:\?|$)/.test(url));
}

async function runCase(browser, spec) {
  const viewport = spec.mobile
    ? { width: 390, height: 844 }
    : { width: 1280, height: 900 };
  const context = await browser.newContext({
    viewport,
    geolocation: spec.geo ? { latitude: spec.geo.lat, longitude: spec.geo.lon } : undefined,
    permissions: spec.geo ? ['geolocation'] : [],
  });
  const page = await context.newPage();
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));

  if (spec.geo) {
    await page.addInitScript((coords) => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({ coords: { latitude: coords.lat, longitude: coords.lon, accuracy: 20 } });
      };
    }, spec.geo);
  }

  await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#search-form');

  let firstResult = null;
  let overflow = null;
  let optionCount = null;

  if (spec.id === 'initial_page') {
    optionCount = await page.locator('#object-input option').count();
  } else if (spec.geo) {
    await page.evaluate((objectText) => {
      const select = document.getElementById('object-input');
      let option = [...select.options].find((o) => o.value === objectText);
      if (!option) {
        option = document.createElement('option');
        option.value = objectText;
        option.textContent = objectText;
        select.appendChild(option);
      }
      select.value = objectText;
    }, spec.object);
    await page.click('#locate-btn');
    await page.waitForSelector('.result-card', { timeout: 60000 });
  } else {
    if (spec.object) {
      await page.selectOption('#object-input', spec.object);
    }
    await page.fill('#zip-input', spec.zip);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.result-card', { timeout: 60000 });
  }

  await page.waitForTimeout(800);

  if (spec.id !== 'initial_page') {
    firstResult = {
      title: (await page.locator('.result-title').first().textContent())?.trim() || null,
      note: (await page.locator('.result-note').first().textContent())?.trim() || null,
      status: (await page.locator('#status-message').textContent())?.trim() || null,
    };
  }

  if (spec.mobile) {
    overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
  }

  const timing = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => ({
      name: e.name,
      transferSize: e.transferSize,
      encodedBodySize: e.encodedBodySize,
      decodedBodySize: e.decodedBodySize,
      initiatorType: e.initiatorType,
    })),
  );

  const nationalJson = nationalJsonUrls(requested);
  const nationalTiming = timing.filter((e) => /\/js\/national\/.*\.json(?:\?|$)/.test(e.name));
  const screenshot = join(outDir, `${spec.id}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  return {
    id: spec.id,
    class: spec.class,
    productionUrl: PRODUCTION_URL,
    input: {
      zip: spec.zip || null,
      object: spec.object || null,
      geo: spec.geo || null,
      viewport,
    },
    optionCount,
    nationalJsonRequested: nationalJson,
    nationalJsonCount: nationalJson.length,
    nationalBytes: {
      transferSizeSum: nationalTiming.reduce((s, e) => s + (e.transferSize || 0), 0),
      encodedBodySizeSum: nationalTiming.reduce((s, e) => s + (e.encodedBodySize || 0), 0),
      decodedBodySizeSum: nationalTiming.reduce((s, e) => s + (e.decodedBodySize || 0), 0),
      entries: nationalTiming,
    },
    allRequestCount: requested.length,
    firstUsefulResultRendered: spec.id === 'initial_page' ? null : Boolean(firstResult?.title),
    firstResult,
    overflow,
    mobileUsable:
      spec.mobile && overflow
        ? overflow.scrollWidth <= overflow.clientWidth + 1 && Boolean(firstResult?.title)
        : undefined,
    screenshot: `.cibt/pass-013/evidence/stage-b/${spec.id}.png`,
    latencyClaim: 'Local collector timing is observational only and does not predict internet latency.',
  };
}

mkdirSync(outDir, { recursive: true });
const capturedAt = new Date().toISOString();
const browser = await chromium.launch();
const rows = [];
for (const spec of CASES) {
  rows.push(await runCase(browser, spec));
}
await browser.close();

const html = await fetch(PRODUCTION_URL).then((r) => r.text());
const live = {
  capturedAt,
  productionUrl: PRODUCTION_URL,
  releaseMeta: (html.match(/name="cibt-release" content="([^"]+)"/) || [])[1] || null,
  hasHsdCredit: /Website built by Hoopsnake Designs/i.test(html),
  hsdHref: (html.match(/href="(https:\/\/hoopsnakedesigns\.com\/?)"/i) || [])[1] || null,
  hasGa4: /gtag\/js\?id=G-XH5G18F3V2/.test(html),
  hasSearchConsole: /google-site-verification/.test(html),
  hasPrivacyDisclosure: /does not intentionally send your search text, ZIP code, or precise location/i.test(html),
  hasLotExplainer: /What is a Library of Things/i.test(html),
  hasFakeTestimonial: /testimonial|they said|customers love|thousands of users/i.test(html),
  hasRevenueClaim: /revenue|\$\d|affiliate|sponsored/i.test(html),
};

const report = { capturedAt, productionUrl: PRODUCTION_URL, liveHtml: live, cases: rows };
writeFileSync(join(outDir, 'production-evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ capturedAt, cases: rows.map((r) => ({
  id: r.id,
  nationalJsonCount: r.nationalJsonCount,
  firstUsefulResultRendered: r.firstUsefulResultRendered,
  mobileUsable: r.mobileUsable,
  nationalTransferSizeSum: r.nationalBytes.transferSizeSum,
})), live }, null, 2));
