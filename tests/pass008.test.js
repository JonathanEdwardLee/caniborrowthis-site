import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../js/search.js';
import { resolveGeoSearchTarget } from '../js/geo.js';
import { CIBT_RELEASE } from '../js/release.js';
import { SOURCES, SPRINGFIELD_MO_ZIPS, RESULT_CLASS } from '../js/data.js';
import packageJson from '../package.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(root, 'js');

const SPRINGFIELD_COORDS = { lat: 37.208957, lon: -93.292298 };
const MOUNTAIN_HOME_COORDS = { lat: 36.335376, lon: -92.385254 };

const LEGACY_SOURCE_IDS = [
  'S1_ALTOONA_TOOL',
  'S2_OLEY_DIAGNOSTIC',
  'S3_MA_LIBRARY_OF_THINGS',
  'S4_LIBRARY_TELESCOPE_PROGRAM',
  'S5_DEKALB_LIBRARY_FALLBACK',
  'S6_WILLIAMSBURG_LIBRARY_FALLBACK',
];

describe('P8-01 only S7/S8/S9 source additions', () => {
  it('adds exactly three new frozen sources without unrelated expansion', () => {
    assert.equal(SOURCES.length, 9);
    const ids = SOURCES.map((s) => s.id);
    assert.deepEqual(
      ids.filter((id) => !LEGACY_SOURCE_IDS.includes(id)).sort(),
      ['S7_SPRINGFIELD_TOOL_LIBRARY', 'S8_SPRINGFIELD_MAKER_SPACE', 'S9_BAXTER_SPECIAL_COLLECTIONS'].sort(),
    );
  });
});

describe('P8-02 Springfield GEO pressure washer routes to S7', () => {
  it('selects Springfield tool library before any distant fallback', () => {
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
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
  });
});

describe('P8-03 Springfield GEO 3D printer routes to S8 with on-site wording', () => {
  it('returns maker space resource with explicit not-take-home note', () => {
    const target = resolveGeoSearchTarget(
      SPRINGFIELD_COORDS.lat,
      SPRINGFIELD_COORDS.lon,
      '3D printer',
    );
    assert.equal(target.kind, 'zip');
    assert.ok(SPRINGFIELD_MO_ZIPS.includes(target.zip));

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
});

describe('P8-04 Mountain Home GEO telescope routes to S9', () => {
  it('selects Baxter special collections before national telescope resource', () => {
    const target = resolveGeoSearchTarget(
      MOUNTAIN_HOME_COORDS.lat,
      MOUNTAIN_HOME_COORDS.lon,
      'telescope',
    );
    assert.equal(target.kind, 'zip');
    assert.equal(target.zip, '72653');

    const out = search({
      objectText: 'telescope',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
  });
});

describe('P8-05 Mountain Home GEO ukulele routes to S9', () => {
  it('returns Baxter special collections for ukulele', () => {
    const target = resolveGeoSearchTarget(
      MOUNTAIN_HOME_COORDS.lat,
      MOUNTAIN_HOME_COORDS.lon,
      'ukulele',
    );
    assert.equal(target.kind, 'zip');
    assert.equal(target.zip, '72653');

    const out = search({
      objectText: 'ukulele',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });
});

describe('P8-06 ZIP 72653 fishing pole manual search', () => {
  it('returns Baxter special collections on manual ZIP search', () => {
    const out = search({ objectText: 'fishing pole', zip: '72653', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });
});

describe('P8-07 Springfield manual ZIP routing and unsupported honesty', () => {
  it('routes ladder at representative Springfield ZIP to S7', () => {
    const out = search({ objectText: 'ladder', zip: '65807', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
  });

  it('routes vinyl cutter at representative Springfield ZIP to S8', () => {
    const out = search({ objectText: 'vinyl cutter', zip: '65802', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S8_SPRINGFIELD_MAKER_SPACE');
  });

  it('keeps unsupported object honest at Springfield ZIP', () => {
    const out = search({ objectText: 'chainsaw', zip: '65807', locationMode: 'ZIP' });
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.unsupportedObject));
    assert.equal(out.results.length, 0);
  });
});

describe('P8-08 trust contracts without live availability claims', () => {
  it('S7 links live inventory browse and cites eligibility caveat', () => {
    const s7 = SOURCES.find((s) => s.id === 'S7_SPRINGFIELD_TOOL_LIBRARY');
    assert.match(s7.url, /myturn\.com\/library\/inventory\/browse/);
    assert.match(s7.note, /do not claim/i);
    assert.match(s7.note, /ZIP code alone does not prove eligibility/i);
  });

  it('S9 tells users to check source for current availability', () => {
    const s9 = SOURCES.find((s) => s.id === 'S9_BAXTER_SPECIAL_COLLECTIONS');
    assert.match(s9.note, /check the source for current availability/i);
    assert.doesNotMatch(s9.note, /currently available/i);
  });
});

describe('P8-09 Pass-006 GEO regressions preserved', () => {
  it('Huntsville sewing machine still avoids fallback-only Fort Payne', () => {
    const target = resolveGeoSearchTarget(34.7304, -86.5861, 'sewing machine');
    assert.equal(target.kind, 'zip');
    assert.notEqual(target.zip, '35967');
    assert.equal(target.zip, '16693');
  });

  it('binoculars distant GEO still uses national-only path without ZIP autofill', () => {
    const target = resolveGeoSearchTarget(34.7304, -86.5861, 'binoculars');
    assert.equal(target.kind, 'national');
  });

  it('manual ZIP 16693 sewing machine ranking unchanged', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    assert.equal(out.results[0].sourceId, 'S1_ALTOONA_TOOL');
  });
});

describe('P8-11 GEO does not present internal routing ZIP as detected ZIP', () => {
  it('app.js keeps visible ZIP blank on GEO zip routing', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    assert.doesNotMatch(appJs, /zipInput\.value = target\.zip/);
    assert.match(appJs, /zipInput\.value = ''/);
  });
});

describe('P8-10 pass011 release identity, dependency state, and accessibility', () => {
  it('index.html and runtime imports use pass011', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /cibt-release" content="pass011"/);
    assert.match(html, /styles\.css\?v=pass011/);
    assert.match(html, /app\.js\?v=pass011/);
  });

  it('every relative runtime .js import uses pass011 version query', async () => {
    const importPattern = /from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
    for (const name of (await readdir(JS_DIR)).filter((entry) => entry.endsWith('.js'))) {
      const relPath = join('js', name);
      const content = await readFile(join(root, relPath), 'utf8');
      for (const [, specifier] of content.matchAll(importPattern)) {
        assert.match(specifier, /\.js\?v=pass011$/, `${relPath} import "${specifier}"`);
      }
    }
  });

  it('release.js exports pass011 identity', () => {
    assert.equal(CIBT_RELEASE.pass, 'pass011');
    assert.equal(CIBT_RELEASE.version, 'pass011');
  });

  it('Playwright remains exact 1.62.1', () => {
    assert.equal(packageJson.devDependencies.playwright, '1.62.1');
  });

  it('index.html retains labeled inputs and viewport', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /for="object-input"/);
    assert.match(html, /<select id="object-input"/);
    assert.match(html, /for="zip-input"/);
    assert.match(html, /viewport/);
  });
});
