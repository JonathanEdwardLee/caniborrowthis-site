import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../js/search.js';
import { resolveGeoSearchTarget, getOzarksCity, validateZip } from '../js/geo.js';
import { RESULT_CLASS, SOURCES, getAllSources, PILOT_ZIPS, SPRINGFIELD_MO_ZIPS } from '../js/data.js';
import {
  OZARKS_CITIES,
  OZARKS_SOURCES,
  OZARKS_TRANSFER_HASHES,
  OZARKS_TRANSFER_COUNTS,
} from '../js/ozarks-generated.js';
import { bridgeEventToGa4, FORBIDDEN_GA_KEYS } from '../js/measure.js';
import packageJson from '../package.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PRODUCT_HASHES = {
  'ozarks_city_filters.csv':
    '38917bb9fd9f14a9b4cf0feb0e69971949ad5d9b89bb3bf2cd2af21ec5eb206e',
  'ozarks_key_city_category_probes_85.csv':
    '8934f116c49ff733d44d92a2259fc44a3f3709bf8df4b84fe617ba02c4213ebd',
};

const AVAILABILITY_CLAIM = /available now|in stock|currently available to borrow|on the shelf now/i;

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

describe('P11-01 transfer integrity', () => {
  it('matches product_transfer_sha256 for both CSVs and generated hashes', async () => {
    for (const [name, expected] of Object.entries(PRODUCT_HASHES)) {
      const buf = await readFile(join(root, '.cibt', 'pass-011', name));
      assert.equal(sha256(buf), expected, name);
      assert.equal(OZARKS_TRANSFER_HASHES[name], expected);
    }
  });

  it('has 76 city rows, 75 route-eligible, one REVIEW_HOLD', () => {
    assert.equal(OZARKS_CITIES.length, 76);
    assert.equal(OZARKS_CITIES.filter((c) => c.productRouteEligible).length, 75);
    assert.equal(OZARKS_CITIES.filter((c) => c.reviewHold).length, 1);
    assert.equal(OZARKS_TRANSFER_COUNTS.cityRows, 76);
    assert.equal(OZARKS_TRANSFER_COUNTS.routeEligible, 75);
    assert.equal(OZARKS_TRANSFER_COUNTS.reviewHold, 1);
  });
});

describe('P11-02 Eureka AR REVIEW_HOLD never routes', () => {
  it('has no ZIP, coordinates, or product route', () => {
    const eureka = getOzarksCity('Eureka', 'AR');
    assert.ok(eureka);
    assert.equal(eureka.productRouteEligible, false);
    assert.equal(eureka.reviewHold, true);
    assert.equal(eureka.representativeZip, null);
    assert.equal(eureka.lat, null);
    assert.equal(eureka.lon, null);
    assert.equal(eureka.destinationUrl, null);
    assert.ok(!OZARKS_SOURCES.some((s) => s.cityKey === 'Eureka|AR'));
    assert.ok(!Object.values(PILOT_ZIPS).some((info) => info.ozarksCityKey === 'Eureka|AR'));
  });

  it('does not collapse Eureka AR into Eureka Springs', () => {
    const springs = getOzarksCity('Eureka Springs', 'AR');
    const eureka = getOzarksCity('Eureka', 'AR');
    assert.ok(springs.productRouteEligible);
    assert.equal(springs.representativeZip, '72632');
    assert.notEqual(eureka.representativeZip, springs.representativeZip);
    const springsOut = search({ objectText: 'telescope', zip: '72632', locationMode: 'ZIP' });
    assert.equal(springsOut.status, 'ok');
    assert.ok(springsOut.results.length >= 1);
    assert.ok(springsOut.results.some((r) => /Eureka Springs|Arkansas State Library/i.test(r.title)));
  });
});

describe('P11-03 Springfield and Mountain Home regressions', () => {
  it('keeps Pass-010 specialist sources first', () => {
    const washer = search({ objectText: 'pressure washer', zip: '65807', locationMode: 'ZIP' });
    assert.equal(washer.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
    const pole = search({ objectText: 'fishing pole', zip: '72653', locationMode: 'ZIP' });
    assert.equal(pole.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
    assert.equal(SOURCES.length, 9);
    assert.ok(SPRINGFIELD_MO_ZIPS.includes('65897'));
    const extra = search({ objectText: 'ladder', zip: '65897', locationMode: 'ZIP' });
    assert.equal(extra.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
  });
});

describe('P11-04 representative ZIP fallbacks', () => {
  it('routes Lampe, Point Lookout, Ridgedale, and Locust Grove to generic ask/check sources', () => {
    for (const zip of ['65681', '65726', '65739', '72550']) {
      const out = search({ objectText: 'telescope', zip, locationMode: 'ZIP' });
      assert.equal(out.status, 'ok', zip);
      assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK), zip);
      for (const result of out.results.filter((r) => r.class === RESULT_CLASS.FALLBACK)) {
        assert.match(result.note, /ask\/check/i);
        assert.match(result.note, /No selected-object relevance or current availability is asserted/i);
        assert.doesNotMatch(result.note, AVAILABILITY_CLAIM);
        assert.equal(result.objectRelevance, 'NONE_ASSERTED');
      }
    }
  });
});

describe('P11-05 malformed vs unsupported ZIP', () => {
  it('distinguishes format-invalid from well-formed uncovered ZIP', () => {
    assert.equal(validateZip('12a45').status, 'INVALID');
    assert.equal(validateZip('99999').status, 'UNSUPPORTED');
    const bad = search({ objectText: 'telescope', zip: '12a45' });
    assert.equal(bad.status, 'error');
    assert.equal(bad.message, MESSAGES.invalidZip);
    const unsupported = search({ objectText: 'telescope', zip: '99999' });
    assert.equal(unsupported.status, 'error');
    assert.equal(unsupported.message, MESSAGES.unsupportedZip);
    assert.notEqual(bad.message, unsupported.message);
  });
});

describe('P11-06 HOLD and CANDIDATE probes stay unpublished as specialists', () => {
  it('does not publish HOLD or CANDIDATE as relevant borrowing programs', () => {
    assert.ok(!OZARKS_SOURCES.some((s) => s.probeStatus === 'HOLD'));
    assert.ok(!OZARKS_SOURCES.some((s) => s.probeStatus === 'CANDIDATE'));
    const joplin = search({ objectText: 'telescope', zip: '64801', locationMode: 'ZIP' });
    assert.ok(!joplin.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    const eurekaSprings = search({ objectText: 'telescope', zip: '72632', locationMode: 'ZIP' });
    assert.ok(!eurekaSprings.results.some((r) => r.class === RESULT_CLASS.RELEVANT && /Eureka Springs/i.test(r.title)));
  });

  it('does not promote Bentonville DIY tools evidence into a pressure-washer relevant claim', () => {
    const out = search({ objectText: 'pressure washer', zip: '72712', locationMode: 'ZIP' });
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    const diy = search({ objectText: 'home repair tool', zip: '72712', locationMode: 'ZIP' });
    const resource = diy.results.find((r) => r.sourceId === 'OZ_BENTONVILLE_DIY_RESOURCE');
    assert.ok(resource);
    assert.equal(resource.class, RESULT_CLASS.RESOURCE);
    assert.match(resource.note, /does not prove a specific tool/i);
  });
});

describe('P11-07 accepted specialists outrank generic fallback', () => {
  it('ranks Rogers telescope above nearby-library fallback', () => {
    const out = search({ objectText: 'telescope', zip: '72758', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'OZ_ROGERS_TELESCOPE');
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
    const fallbackIdx = out.results.findIndex((r) => r.class === RESULT_CLASS.FALLBACK);
    assert.ok(fallbackIdx > 0);
  });
});

describe('P11-08 Pass-010 non-Ozarks regressions', () => {
  it('keeps Altoona sewing and MA telescope resource working', () => {
    const sewing = search({ objectText: 'sewing machine', zip: '16693' });
    assert.equal(sewing.results[0].sourceId, 'S1_ALTOONA_TOOL');
    const ma = search({ objectText: 'telescope', zip: '01103' });
    assert.ok(ma.results.some((r) => r.sourceId === 'S3_MA_LIBRARY_OF_THINGS'));
    const huntsville = resolveGeoSearchTarget(34.7304, -86.5861, 'sewing machine');
    assert.equal(huntsville.zip, '16693');
  });
});

describe('P11-09 analytics still omit raw object/ZIP/coordinates', () => {
  it('search_submitted still uses object_class only and ignores extra location fields', () => {
    const calls = [];
    const gtag = (...args) => calls.push(args);
    bridgeEventToGa4(
      {
        type: 'search_submitted',
        objectClass: 'TELESCOPE',
        locationMode: 'GEO',
        coverageState: 'SUPPORTED',
        zip: '65681',
        objectText: 'telescope',
        latitude: 36.56,
        longitude: -93.43,
      },
      gtag,
    );
    assert.deepEqual(calls[0][2], {
      object_class: 'TELESCOPE',
      location_mode: 'GEO',
      coverage_state: 'SUPPORTED',
    });
    const serialized = JSON.stringify(calls[0][2]);
    assert.equal(serialized.includes('65681'), false);
    assert.equal(serialized.includes('36.56'), false);
    for (const key of Object.keys(calls[0][2])) {
      assert.ok(!FORBIDDEN_GA_KEYS.includes(key), `forbidden GA field: ${key}`);
    }
  });
});

describe('P11-10 public copy forbids exact availability claims', () => {
  it('scans public HTML/JS/generated notes', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, AVAILABILITY_CLAIM);
    for (const source of getAllSources()) {
      assert.doesNotMatch(source.note, AVAILABILITY_CLAIM, source.id);
      assert.doesNotMatch(source.title, AVAILABILITY_CLAIM, source.id);
    }
    for (const msg of Object.values(MESSAGES)) {
      assert.doesNotMatch(msg, AVAILABILITY_CLAIM);
    }
  });
});

describe('P11-11 GEO does not fabricate detected ZIP', () => {
  it('app.js still blanks the visible ZIP on GEO routing', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    assert.doesNotMatch(appJs, /zipInput\.value = target\.zip/);
    assert.match(appJs, /zipInput\.value = ''/);
  });
});

describe('P11-12 generator is deterministic', () => {
  it('npm run generate:ozarks is available and hashes stay stable', async () => {
    assert.equal(packageJson.scripts['generate:ozarks'], 'node scripts/generate-ozarks-data.mjs');
    execFileSync('node', ['scripts/generate-ozarks-data.mjs'], { cwd: root });
    const generated = await readFile(join(root, 'js', 'ozarks-generated.js'));
    const again = sha256(generated);
    execFileSync('node', ['scripts/generate-ozarks-data.mjs'], { cwd: root });
    const regenerated = sha256(await readFile(join(root, 'js', 'ozarks-generated.js')));
    assert.equal(again, regenerated);
  });
});
