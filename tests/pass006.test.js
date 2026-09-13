import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../js/search.js';
import {
  nearestEligibleCoverageZip,
  resolveGeoSearchTarget,
  formatGeoCoverageContext,
  GEO_CONTEXT_THRESHOLD_MI,
} from '../js/geo.js';
import { normalizeObject } from '../js/normalize.js';
import { CIBT_RELEASE } from '../js/release.js';
import { RESULT_CLASS } from '../js/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(root, 'js');

/** Huntsville, AL — Fort Payne (35967) is nearest fallback-only eligible centroid. */
const FORT_PAYNE_NEAREST_COORDS = { lat: 34.7304, lon: -86.5861 };
const FORT_PAYNE_CENTROID = { lat: 34.4071, lon: -85.7046 };

describe('P6-01 object classification precedes GEO destination', () => {
  it('app.js uses resolveGeoSearchTarget, not nearestEligibleCoverageZip', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    assert.match(appJs, /normalizeObject\(/);
    assert.match(appJs, /resolveGeoSearchTarget\(/);
    assert.doesNotMatch(appJs, /nearestEligibleCoverageZip/);
  });

  it('resolveGeoSearchTarget normalizes object before choosing destination', async () => {
    const naive = nearestEligibleCoverageZip(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
    );
    assert.equal(naive.zip, '35967');

    const aware = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'sewing machine',
    );
    assert.equal(aware.kind, 'zip');
    assert.notEqual(aware.zip, '35967');
    assert.equal(normalizeObject('sewing machine').status, 'SUPPORTED');
  });
});

describe('P6-02 sewing machine avoids fallback-only Fort Payne centroid', () => {
  it('selects nearest reviewed geography-bound sewing path, not 35967', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'sewing machine',
    );
    assert.equal(target.kind, 'zip');
    assert.notEqual(target.zip, '35967');
    assert.equal(target.zip, '16693');

    const out = search({
      objectText: 'sewing machine',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    assert.equal(out.results[0].sourceId, 'S1_ALTOONA_TOOL');
  });
});

describe('P6-03 OBD-II scanner object-aware GEO', () => {
  it('selects nearest reviewed geography-bound OBD path, not 35967', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'OBD-II scanner',
    );
    assert.equal(target.kind, 'zip');
    assert.notEqual(target.zip, '35967');
    assert.equal(target.zip, '19601');

    const out = search({
      objectText: 'OBD-II scanner',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    assert.equal(out.results[0].sourceId, 'S2_OLEY_DIAGNOSTIC');
  });
});

describe('P6-04 binoculars national-only GEO path', () => {
  it('returns national specialist resource without unrelated ZIP autofill', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'binoculars',
    );
    assert.equal(target.kind, 'national');

    const out = search({
      objectText: 'binoculars',
      zip: '',
      locationMode: 'GEO',
      geoTargetKind: 'national',
    });
    assert.equal(out.status, 'ok');
    assert.match(out.message, /local-area match/i);
    assert.equal(out.disclaimers.length, 0);
    assert.ok(out.results.some((r) => r.sourceId === 'S4_LIBRARY_TELESCOPE_PROGRAM'));
    assert.ok(out.results.every((r) => r.class === RESULT_CLASS.RESOURCE));
  });
});

describe('P6-05 unsupported/unrecognized distant GEO', () => {
  it('uses national nearest outlet without exposing a detected ZIP in the search contract', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'chainsaw',
    );
    assert.equal(target.kind, 'national_outlet');
    assert.ok(target.zip);
    assert.ok(target.nationalRoute);

    const { buildNationalFallbackSource } = await import('../js/national-routing.js');
    const source = await buildNationalFallbackSource(target.nationalRoute);
    const out = search({
      objectText: 'chainsaw',
      zip: target.zip,
      locationMode: 'GEO',
      geoTargetKind: 'national_outlet',
      geoDistanceMi: target.distanceMi,
      nationalZipContext: {
        kind: 'observed',
        zip: target.zip,
        route: target.nationalRoute,
        source,
      },
      nationalRoute: target.nationalRoute,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.unsupportedObject));
  });

  it('uses national nearest outlet for unrecognized object without dead end', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'widget',
    );
    assert.equal(target.kind, 'national_outlet');

    const { buildNationalFallbackSource } = await import('../js/national-routing.js');
    const source = await buildNationalFallbackSource(target.nationalRoute);
    const out = search({
      objectText: 'widget',
      zip: target.zip,
      locationMode: 'GEO',
      geoTargetKind: 'national_outlet',
      geoDistanceMi: target.distanceMi,
      nationalZipContext: {
        kind: 'observed',
        zip: target.zip,
        route: target.nationalRoute,
        source,
      },
      nationalRoute: target.nationalRoute,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.unrecognizedObject));
  });
});

describe('P6-06 near fallback centroid retains generic fallback', () => {
  it('shows generic fallback when user is within threshold of fallback centroid', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_CENTROID.lat,
      FORT_PAYNE_CENTROID.lon,
      'chainsaw',
    );
    assert.equal(target.kind, 'zip');
    assert.equal(target.zip, '35967');
    assert.ok(target.distanceMi <= GEO_CONTEXT_THRESHOLD_MI);

    const out = search({
      objectText: 'chainsaw',
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.unsupportedObject));
  });
});

describe('P6-07 manual ZIP regressions unchanged', () => {
  it('SC-01 sewing machine + 16693 still ranks relevant program first', async () => {
    const out = search({ objectText: 'sewing machine', zip: '16693', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S1_ALTOONA_TOOL');
    assert.equal(out.results[0].distanceLabel, 'Approx. 10.7 mi');
  });

  it('90210 manual ZIP still has no invented fallback', async () => {
    const out = search({ objectText: 'pressure washer', zip: '90210', locationMode: 'ZIP' });
    assert.equal(out.results.length, 0);
    assert.equal(out.message, MESSAGES.noNearbyEvidence);
  });
});

describe('P6-08 ranking privacy accessibility regressions', () => {
  it('relevant program still ranks before fallback on manual ZIP', async () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
  });

  it('search_submitted measurement omits raw query fields', async () => {
    const { onMeasure, measureSearchSubmitted } = await import('../js/measure.js');
    const captured = [];
    onMeasure((e) => captured.push(e));
    measureSearchSubmitted({
      objectClass: 'SEWING_MACHINE',
      locationMode: 'GEO',
      coverageState: 'SUPPORTED',
    });
    const evt = captured[0];
    assert.ok(!('zip' in evt));
    assert.ok(!('coordinates' in evt));
    assert.ok(!('rawObject' in evt));
  });

  it('index.html retains labeled inputs and viewport', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /for="object-input"/);
    assert.match(html, /<select id="object-input"/);
    assert.match(html, /for="zip-input"/);
    assert.match(html, /viewport/);
  });
});

describe('P6-10 object-aware distant GEO context copy', () => {
  it('uses truthful search-specific wording for Huntsville sewing machine', async () => {
    const target = await resolveGeoSearchTarget(
      FORT_PAYNE_NEAREST_COORDS.lat,
      FORT_PAYNE_NEAREST_COORDS.lon,
      'sewing machine',
    );
    const context = formatGeoCoverageContext(target.label, target.distanceMi);
    assert.match(context, /closest reviewed source area for this search/i);
    assert.doesNotMatch(context, /closest area we currently cover/i);
    assert.match(context, /Williamsburg/i);
  });
});

describe('P6-09 pass012 release identity and versioned assets', () => {
  it('index.html requests pass012-versioned CSS and entry JS', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /href="css\/styles\.css\?v=pass012"/);
    assert.match(html, /src="js\/app\.js\?v=pass012"/);
  });

  it('every relative runtime .js import uses pass012 version query', async () => {
    const importPattern = /from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
    const jsEntries = await readdir(JS_DIR);

    for (const name of jsEntries.filter((entry) => entry.endsWith('.js'))) {
      const relPath = join('js', name);
      const content = await readFile(join(root, relPath), 'utf8');
      for (const [, specifier] of content.matchAll(importPattern)) {
        assert.match(
          specifier,
          /\.js\?v=pass012$/,
          `${relPath} import "${specifier}" must use ?v=pass012`,
        );
      }
    }
  });

  it('index.html exposes pass012 release meta and hidden DOM marker', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /<meta name="cibt-release" content="pass012">/);
    assert.match(html, /id="cibt-release-marker"[^>]*data-release="pass012"/);
  });

  it('release.js exports pass012 identity without commit stamp', async () => {
    assert.equal(CIBT_RELEASE.pass, 'pass012');
    assert.equal(CIBT_RELEASE.version, 'pass012');
    assert.equal(CIBT_RELEASE.commit, undefined);
  });
});
