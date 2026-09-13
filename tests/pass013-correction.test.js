import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../js/search.js';
import { normalizeObject } from '../js/normalize.js';
import { resolveGeoSearchTarget } from '../js/geo.js';
import { RESULT_CLASS } from '../js/data.js';
import { bridgeEventToGa4, FORBIDDEN_GA_KEYS } from '../js/measure.js';
import {
  OBJECT_OPTIONS,
  ITEM_OBJECT_OPTIONS,
  DEFAULT_OBJECT_VALUE,
  EXPLORE_ALL_VALUE,
} from '../js/object-options.js';
import { buildNationalFallbackSource } from '../js/national-routing.js';
import { preloadNationalData, searchWithNational } from './helpers/national.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = EXPLORE_ALL_VALUE;
const SPRINGFIELD = { lat: 37.208957, lon: -93.292298 };
const MOUNTAIN_HOME = { lat: 36.335376, lon: -92.385254 };
const NYC = { lat: 40.7589, lon: -73.9851 };
const AVAILABILITY = /available now|in stock|currently available to borrow|on the shelf now/i;
const ITEM_FAIL = /We don't have a relevant borrowing source for this object/i;

async function geoAll(lat, lon) {
  const target = await resolveGeoSearchTarget(lat, lon, ALL);
  if (target.kind === 'national_outlet') {
    const source = await buildNationalFallbackSource(target.nationalRoute);
    return search({
      objectText: ALL,
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
  }
  if (target.kind === 'zip') {
    return search({
      objectText: ALL,
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
      cityKey: target.cityKey,
    });
  }
  return search({ objectText: ALL, zip: '', locationMode: 'GEO', geoTargetKind: target.kind });
}

before(async () => {
  await preloadNationalData();
});

describe('P13-C All/Explore nearby + HSD credit', () => {
  it('A1: All is first/default and 35 item choices remain', () => {
    assert.equal(OBJECT_OPTIONS[0].value, EXPLORE_ALL_VALUE);
    assert.equal(DEFAULT_OBJECT_VALUE, EXPLORE_ALL_VALUE);
    assert.equal(ITEM_OBJECT_OPTIONS.length, 35);
    assert.equal(OBJECT_OPTIONS.length, 36);
    assert.equal(normalizeObject(ALL).status, 'BROWSE_ALL');
    assert.equal(normalizeObject(ALL).objectClass, 'BROWSE_ALL');
  });

  it('A2: Springfield 65807 + All returns local sources ahead of national fallback', () => {
    const out = search({ objectText: ALL, zip: '65807', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.equal(out.objectClass, 'BROWSE_ALL');
    assert.equal(out.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
    assert.ok(out.results.some((r) => r.sourceId === 'S8_SPRINGFIELD_MAKER_SPACE'));
    assert.ok(!out.results[0].sourceId.startsWith('NAT_'));
    assert.equal(out.message, MESSAGES.browseNearby);
    assert.doesNotMatch(out.message, ITEM_FAIL);
  });

  it('A3: Mountain Home 72653 + All returns Baxter County context', () => {
    const out = search({ objectText: ALL, zip: '72653', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });

  it('A4: 01001 + All returns official place to check', async () => {
    const out = await searchWithNational(search, { objectText: ALL, zip: '01001', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.length >= 1);
    assert.match(out.results[0].title, /official page to ask\/check/i);
    assert.doesNotMatch(`${out.message}\n${out.results[0].note}`, AVAILABILITY);
  });

  it('A5: 72730 + All stays conservative', () => {
    const out = search({ objectText: ALL, zip: '72730', locationMode: 'ZIP' });
    assert.ok(!out.results.some((r) => r.sourceId === 'OZ_FAYETTEVILLE_FAB_LAB'));
  });

  it('A6: 90210 + All is not a dead end', async () => {
    const out = await searchWithNational(search, { objectText: ALL, zip: '90210', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.length >= 1);
    assert.notEqual(out.message, MESSAGES.invalidZip);
    assert.notEqual(out.message, MESSAGES.noNearbyEvidence);
  });

  it('A7: 99999 + All uses IMLS Search & Compare', async () => {
    const out = await searchWithNational(search, { objectText: ALL, zip: '99999', locationMode: 'ZIP' });
    assert.ok(out.results.some((r) => /IMLS Search & Compare/i.test(r.title)));
  });

  it('A8: malformed ZIP + All remains invalid', () => {
    const out = search({ objectText: ALL, zip: '12a45' });
    assert.equal(out.status, 'error');
    assert.equal(out.message, MESSAGES.invalidZip);
  });

  it('A9: Springfield GEO + All is nearby browse without availability claims', async () => {
    const target = await resolveGeoSearchTarget(SPRINGFIELD.lat, SPRINGFIELD.lon, ALL);
    assert.equal(target.kind, 'zip');
    const out = await geoAll(SPRINGFIELD.lat, SPRINGFIELD.lon);
    assert.ok(out.results.some((r) => r.sourceId === 'S7_SPRINGFIELD_TOOL_LIBRARY'));
    assert.doesNotMatch([out.message, ...out.results.map((r) => r.note)].join('\n'), AVAILABILITY);
    assert.doesNotMatch(out.message, ITEM_FAIL);
  });

  it('A10: Mountain Home GEO + All is nearby browse', async () => {
    const out = await geoAll(MOUNTAIN_HOME.lat, MOUNTAIN_HOME.lon);
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
    assert.doesNotMatch(out.message, ITEM_FAIL);
  });

  it('A11: NYC GEO + All uses nearest national outlet with permissioned wording', async () => {
    const target = await resolveGeoSearchTarget(NYC.lat, NYC.lon, ALL);
    assert.equal(target.kind, 'national_outlet');
    assert.equal(target.nationalRoute.routeClass, 'GEO_NEAREST_ACTIVE_OUTLET');
    const out = await geoAll(NYC.lat, NYC.lon);
    assert.match(out.results[0].note, /permissioned location/i);
    assert.doesNotMatch(out.results[0].note, /Census|ZCTA/i);
    assert.match(out.results[0].note, /not eligibility, residency, service-area, or inventory proof/i);
    assert.equal(out.message, MESSAGES.browseNearby);
  });

  it('A12: All-mode copy has no item-specific failure or availability claim', async () => {
    const out = await searchWithNational(search, { objectText: ALL, zip: '01001', locationMode: 'ZIP' });
    const blob = [out.message, ...(out.disclaimers || []), ...out.results.map((r) => `${r.title} ${r.note}`)].join('\n');
    assert.doesNotMatch(blob, ITEM_FAIL);
    assert.doesNotMatch(blob, AVAILABILITY);
  });

  it('A13: HSD footer credit exact destination is present', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /Website built by <a href="https:\/\/hoopsnakedesigns\.com\/"[^>]*>Hoopsnake Designs<\/a>/);
  });

  it('A14: GA browse event is coarse and privacy-safe', () => {
    const captured = [];
    bridgeEventToGa4(
      {
        type: 'search_submitted',
        objectClass: 'BROWSE_ALL',
        locationMode: 'ZIP',
        coverageState: 'BROWSE',
        zip: '65807',
        rawObject: ALL,
        objectText: ALL,
        coordinates: 'secret',
      },
      (_cmd, _name, payload) => captured.push(payload),
    );
    assert.equal(captured.length, 1);
    assert.equal(captured[0].object_class, 'BROWSE_ALL');
    for (const key of FORBIDDEN_GA_KEYS) {
      assert.ok(!(key in captured[0]), key);
    }
  });
});
