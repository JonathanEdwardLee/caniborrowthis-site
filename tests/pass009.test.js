import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bridgeEventToGa4,
  measureSearchSubmitted,
  measureResultsRendered,
  measureOutboundClicked,
  measureLocationPermissionResult,
  onMeasure,
  FORBIDDEN_GA_KEYS,
} from '../js/measure.js';
import { search } from '../js/search.js';
import { resolveGeoSearchTarget } from '../js/geo.js';
import { CIBT_RELEASE } from '../js/release.js';
import { SPRINGFIELD_MO_ZIPS } from '../js/data.js';
import packageJson from '../package.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(root, 'js');
const SEARCH_CONSOLE_TOKEN = 'ZbhXy9475qUe4S8blHG_lYVH73bHf98-3_m3wh6ww24';
const GA4_MEASUREMENT_ID = 'G-XH5G18F3V2';

const SPRINGFIELD_COORDS = { lat: 37.208957, lon: -93.292298 };
const MOUNTAIN_HOME_COORDS = { lat: 36.335376, lon: -92.385254 };

function captureGaCalls(fn) {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  fn(gtag);
  return calls;
}

function eventPayloads(calls) {
  return calls.filter((call) => call[0] === 'event').map((call) => call[2]);
}

function assertNoForbiddenFields(payload) {
  for (const key of Object.keys(payload)) {
    assert.ok(!FORBIDDEN_GA_KEYS.includes(key), `forbidden GA field: ${key}`);
  }
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /16693|72653|sewing machine|latitude|longitude/i);
}

describe('P9-01 Search Console verification token', () => {
  it('index.html contains exact token exactly once', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    const matches = html.match(
      new RegExp(`<meta name="google-site-verification" content="${SEARCH_CONSOLE_TOKEN}">`, 'g'),
    );
    assert.equal(matches?.length, 1);
  });
});

describe('P9-02 GA4 bootstrap', () => {
  it('loads standard gtag bootstrap with exact measurement ID', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(
      html,
      /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-XH5G18F3V2"><\/script>/,
    );
    assert.match(html, /gtag\('config', 'G-XH5G18F3V2'\)/);
    assert.equal((html.match(/G-XH5G18F3V2/g) || []).length, 2);
  });
});

describe('P9-03 no malformed analytics URL syntax', () => {
  it('index.html does not contain Markdown link syntax for gtag URL', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /\[https:\/\/www\.googletagmanager\.com/);
    assert.doesNotMatch(html, /\]\(https:\/\/www\.googletagmanager\.com/);
  });
});

describe('P9-04 GA4 bridge emits only approved coarse fields', () => {
  it('search_submitted maps approved parameters only', () => {
    const calls = captureGaCalls((gtag) => {
      bridgeEventToGa4(
        {
          type: 'search_submitted',
          objectClass: 'SEWING_MACHINE',
          locationMode: 'GEO',
          coverageState: 'SUPPORTED',
        },
        gtag,
      );
    });
    assert.deepEqual(calls[0], [
      'event',
      'search_submitted',
      {
        object_class: 'SEWING_MACHINE',
        location_mode: 'GEO',
        coverage_state: 'SUPPORTED',
      },
    ]);
    assertNoForbiddenFields(eventPayloads(calls)[0]);
  });

  it('results_rendered maps approved count parameters only', () => {
    const calls = captureGaCalls((gtag) => {
      bridgeEventToGa4(
        {
          type: 'results_rendered',
          counts: { RELEVANT: 1, RESOURCE: 0, FALLBACK: 1, NONE: 0 },
        },
        gtag,
      );
    });
    assert.deepEqual(calls[0][1], 'results_rendered');
    assert.deepEqual(calls[0][2], {
      relevant_count: 1,
      resource_count: 0,
      fallback_count: 1,
      none_count: 0,
    });
    assertNoForbiddenFields(calls[0][2]);
  });

  it('outbound_clicked maps approved parameters only', () => {
    const calls = captureGaCalls((gtag) => {
      bridgeEventToGa4(
        {
          type: 'outbound_clicked',
          sourceId: 'S7_SPRINGFIELD_TOOL_LIBRARY',
          resultClass: 'RELEVANT_BORROWING_PROGRAM',
        },
        gtag,
      );
    });
    assert.deepEqual(calls[0][2], {
      source_id: 'S7_SPRINGFIELD_TOOL_LIBRARY',
      result_class: 'RELEVANT_BORROWING_PROGRAM',
    });
    assertNoForbiddenFields(calls[0][2]);
  });

  it('location_permission_result maps result only', () => {
    const calls = captureGaCalls((gtag) => {
      bridgeEventToGa4({ type: 'location_permission_result', result: 'DENIED' }, gtag);
    });
    assert.deepEqual(calls[0][2], { result: 'DENIED' });
    assertNoForbiddenFields(calls[0][2]);
  });

  it('measure hooks bridge through emit without raw query fields', () => {
    const calls = captureGaCalls((gtag) => {
      const originalGtag = globalThis.gtag;
      globalThis.gtag = gtag;
      try {
        measureSearchSubmitted({
          objectClass: 'PRESSURE_WASHER',
          locationMode: 'ZIP',
          coverageState: 'SUPPORTED',
        });
        measureResultsRendered({ relevant: 1, resource: 0, fallback: 0, none: 0 });
        measureOutboundClicked({
          sourceId: 'S9_BAXTER_SPECIAL_COLLECTIONS',
          resultClass: 'RELEVANT_BORROWING_PROGRAM',
        });
        measureLocationPermissionResult({ result: 'GRANTED' });
      } finally {
        globalThis.gtag = originalGtag;
      }
    });
    assert.equal(calls.filter((call) => call[0] === 'event').length, 4);
    for (const payload of eventPayloads(calls)) {
      assertNoForbiddenFields(payload);
    }
  });

  it('onMeasure listeners still receive internal events', () => {
    const captured = [];
    onMeasure((event) => captured.push(event));
    const originalGtag = globalThis.gtag;
    globalThis.gtag = () => {};
    try {
      measureSearchSubmitted({
        objectClass: 'TELESCOPE',
        locationMode: 'GEO',
        coverageState: 'SUPPORTED',
      });
    } finally {
      globalThis.gtag = originalGtag;
    }
    assert.equal(captured.at(-1)?.type, 'search_submitted');
  });
});

describe('P9-05 Pass-008 routing and GEO ZIP trust regressions', () => {
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

  it('Springfield GEO 3D printer routes to S8 with on-site wording', () => {
    const target = resolveGeoSearchTarget(
      SPRINGFIELD_COORDS.lat,
      SPRINGFIELD_COORDS.lon,
      '3D printer',
    );
    const out = search({
      objectText: '3D printer',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.results[0].sourceId, 'S8_SPRINGFIELD_MAKER_SPACE');
    assert.equal(
      out.results[0].usageNote,
      'On-site equipment resource — not a take-home loan.',
    );
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

  it('manual ZIP 72653 fishing pole routes to S9', () => {
    const out = search({ objectText: 'fishing pole', zip: '72653', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });

  it('app.js keeps visible ZIP blank on GEO zip routing', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    assert.doesNotMatch(appJs, /zipInput\.value = target\.zip/);
    assert.match(appJs, /zipInput\.value = ''/);
  });
});

describe('P9-06 pass009 release identity and dependency state', () => {
  it('index.html and runtime imports use pass009', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /cibt-release" content="pass009"/);
    assert.match(html, /styles\.css\?v=pass009/);
    assert.match(html, /app\.js\?v=pass009/);
  });

  it('every relative runtime .js import uses pass009 version query', async () => {
    const importPattern = /from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
    for (const name of (await readdir(JS_DIR)).filter((entry) => entry.endsWith('.js'))) {
      const relPath = join('js', name);
      const content = await readFile(join(root, relPath), 'utf8');
      for (const [, specifier] of content.matchAll(importPattern)) {
        assert.match(specifier, /\.js\?v=pass009$/, `${relPath} import "${specifier}"`);
      }
    }
  });

  it('release.js exports pass009 identity', () => {
    assert.equal(CIBT_RELEASE.pass, 'pass009');
    assert.equal(CIBT_RELEASE.version, 'pass009');
  });

  it('Playwright remains exact 1.62.1', () => {
    assert.equal(packageJson.devDependencies.playwright, '1.62.1');
  });
});
