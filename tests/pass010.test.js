import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bridgeEventToGa4,
  measureSearchSubmitted,
  FORBIDDEN_GA_KEYS,
} from '../js/measure.js';
import { search } from '../js/search.js';
import { normalizeObject } from '../js/normalize.js';
import { resolveGeoSearchTarget } from '../js/geo.js';
import { CIBT_RELEASE } from '../js/release.js';
import { OBJECT_OPTIONS, DEFAULT_OBJECT_VALUE } from '../js/object-options.js';
import { SOURCES, SPRINGFIELD_MO_ZIPS } from '../js/data.js';
import packageJson from '../package.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(root, 'js');
const SEARCH_CONSOLE_TOKEN = 'ZbhXy9475qUe4S8blHG_lYVH73bHf98-3_m3wh6ww24';
const GA4_MEASUREMENT_ID = 'G-XH5G18F3V2';
const ANALYTICS_DISCLOSURE =
  'This site uses Google Analytics to understand how visitors use the site and improve its usefulness. Google may collect information such as device, browser, page-view, and interaction data. Can I Borrow This does not intentionally send your search text, ZIP code, or precise location to Google Analytics.';

const SPRINGFIELD_COORDS = { lat: 37.208957, lon: -93.292298 };
const MOUNTAIN_HOME_COORDS = { lat: 36.335376, lon: -92.385254 };

function reviewedObjectClasses() {
  const classes = new Set();
  for (const source of SOURCES) {
    for (const objectClass of source.objectClasses ?? []) {
      classes.add(objectClass);
    }
  }
  return classes;
}

describe('P10-01 guided object selector', () => {
  it('defaults to telescope', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /<select id="object-input"/);
    assert.doesNotMatch(html, /id="search-ideas"/);
    assert.equal(DEFAULT_OBJECT_VALUE, 'telescope');
  });

  it('lists only reviewed supported object families with canonical values', () => {
    const reviewed = reviewedObjectClasses();
    assert.equal(OBJECT_OPTIONS.length, reviewed.size);
    for (const opt of OBJECT_OPTIONS) {
      assert.ok(reviewed.has(opt.objectClass), `missing reviewed class ${opt.objectClass}`);
      const norm = normalizeObject(opt.value);
      assert.equal(norm.status, 'SUPPORTED');
      assert.equal(norm.objectClass, opt.objectClass);
    }
  });

  it('search works with default telescope without typing', () => {
    const out = search({ objectText: DEFAULT_OBJECT_VALUE, zip: '01103', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.equal(out.objectClass, 'TELESCOPE');
    assert.ok(out.results.length >= 1);
  });

  it('does not expose unsupported objects in selector options', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /chainsaw/i);
    assert.doesNotMatch(html, /<option[^>]*value=""/);
  });
});

describe('P10-02 evergreen explainer placement and content', () => {
  it('explainer sits below results and above footer disclosure', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const resultsIdx = html.indexOf('id="results"');
    const explainerIdx = html.indexOf('id="cibt-explainer"');
    const footerIdx = html.indexOf('class="site-footer"');
    assert.ok(resultsIdx >= 0);
    assert.ok(explainerIdx > resultsIdx);
    assert.ok(footerIdx > explainerIdx);
  });

  it('covers Library of Things, source-check limits, maker-space distinction, borrow-before-buy', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const explainer = html.match(/id="cibt-explainer"[\s\S]*?<\/section>/)?.[0] ?? '';
    assert.match(explainer, /Library of Things/i);
    assert.match(explainer, /Check the source/i);
    assert.match(explainer, /on-site equipment — not take-home loans/i);
    assert.match(explainer, /Borrow before you buy/i);
    assert.doesNotMatch(explainer, /national coverage|100%|guaranteed available/i);
  });
});

describe('P10-03 Pass-008/009 routing and GEO ZIP trust regressions', () => {
  it('Springfield GEO pressure washer routes to S7', () => {
    const target = resolveGeoSearchTarget(
      SPRINGFIELD_COORDS.lat,
      SPRINGFIELD_COORDS.lon,
      'pressure washer',
    );
    assert.equal(target.kind, 'zip');
    assert.ok(SPRINGFIELD_MO_ZIPS.includes(target.zip));
    const out = search({
      objectText: 'pressure washer',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
  });

  it('Mountain Home GEO telescope routes to S9', () => {
    const target = resolveGeoSearchTarget(
      MOUNTAIN_HOME_COORDS.lat,
      MOUNTAIN_HOME_COORDS.lon,
      'telescope',
    );
    assert.equal(target.zip, '72653');
    const out = search({
      objectText: 'telescope',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });

  it('app.js keeps visible ZIP blank on GEO zip routing', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    assert.doesNotMatch(appJs, /zipInput\.value = target\.zip/);
    assert.match(appJs, /zipInput\.value = ''/);
  });
});

describe('P10-04 Pass-009 analytics and disclosure preservation', () => {
  it('Search Console token unchanged', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const matches = html.match(
      new RegExp(`<meta name="google-site-verification" content="${SEARCH_CONSOLE_TOKEN}">`, 'g'),
    );
    assert.equal(matches?.length, 1);
  });

  it('GA4 bootstrap unchanged', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(
      html,
      /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-XH5G18F3V2"><\/script>/,
    );
    assert.match(html, /gtag\('config', 'G-XH5G18F3V2'\)/);
    assert.equal((html.match(/G-XH5G18F3V2/g) || []).length, 2);
  });

  it('founder-approved Analytics disclosure unchanged', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.equal(html.split(ANALYTICS_DISCLOSURE).length - 1, 1);
    assert.match(html, /<p class="analytics-disclosure">/);
  });

  it('search_submitted still uses object_class only', () => {
    const calls = [];
    const gtag = (...args) => calls.push(args);
    bridgeEventToGa4(
      {
        type: 'search_submitted',
        objectClass: 'TELESCOPE',
        locationMode: 'ZIP',
        coverageState: 'SUPPORTED',
      },
      gtag,
    );
    assert.deepEqual(calls[0][2], {
      object_class: 'TELESCOPE',
      location_mode: 'ZIP',
      coverage_state: 'SUPPORTED',
    });
    for (const key of Object.keys(calls[0][2])) {
      assert.ok(!FORBIDDEN_GA_KEYS.includes(key), `forbidden GA field: ${key}`);
    }
  });

  it('measure hooks do not add new analytics events', () => {
    const originalGtag = globalThis.gtag;
    const calls = [];
    globalThis.gtag = (...args) => calls.push(args);
    try {
      measureSearchSubmitted({
        objectClass: 'TELESCOPE',
        locationMode: 'ZIP',
        coverageState: 'SUPPORTED',
      });
    } finally {
      globalThis.gtag = originalGtag;
    }
    assert.equal(calls.filter((call) => call[0] === 'event').length, 1);
    assert.equal(calls[0][1], 'search_submitted');
  });
});

describe('P10-05 pass010 release identity and dependency state', () => {
  it('index.html and runtime imports use pass010', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /cibt-release" content="pass010"/);
    assert.match(html, /styles\.css\?v=pass010/);
    assert.match(html, /app\.js\?v=pass010/);
  });

  it('every relative runtime .js import uses pass010 version query', async () => {
    const importPattern = /from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
    for (const name of (await readdir(JS_DIR)).filter((entry) => entry.endsWith('.js'))) {
      const relPath = join('js', name);
      const content = await readFile(join(root, relPath), 'utf8');
      for (const [, specifier] of content.matchAll(importPattern)) {
        assert.match(specifier, /\.js\?v=pass010$/, `${relPath} import "${specifier}"`);
      }
    }
  });

  it('release.js exports pass010 identity', () => {
    assert.equal(CIBT_RELEASE.pass, 'pass010');
    assert.equal(CIBT_RELEASE.version, 'pass010');
  });

  it('Playwright remains exact 1.62.1', () => {
    assert.equal(packageJson.devDependencies.playwright, '1.62.1');
  });
});
