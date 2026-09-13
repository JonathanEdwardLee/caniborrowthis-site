import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../js/search.js';
import { validateZip, resolveGeoSearchTarget } from '../js/geo.js';
import { RESULT_CLASS, SOURCES, getAllSources, PILOT_ZIPS } from '../js/data.js';
import {
  ensureNationalDataLoaded,
  lookupZipRoute,
  buildNationalFallbackSource,
  findNearestNationalOutlet,
  resolveNationalGeoTarget,
} from '../js/national-routing.js';
import {
  ROUTE_CLASS_COUNTS,
  NATIONAL_TRANSFER_COUNTS,
  NATIONAL_TRANSFER_HASHES,
  NATIONAL_STATES,
  NATIONAL_ASSET_BYTES,
} from '../js/national/constants.js';
import { bridgeEventToGa4, FORBIDDEN_GA_KEYS } from '../js/measure.js';
import { preloadNationalData, searchWithNational } from './helpers/national.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const transferDir = join(root, '.cibt', 'pass-012', 'transfer');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

before(async () => {
  await preloadNationalData();
});

describe('P12-01 transfer integrity', () => {
  it('matches accepted manifest hashes and reconstruction', async () => {
    const manifestBuf = await readFile(join(transferDir, 'national_transfer_manifest.json'));
    assert.equal(sha256(manifestBuf), NATIONAL_TRANSFER_HASHES['national_transfer_manifest.json']);
    assert.equal(manifestBuf.length, 5862);

    for (const name of [
      'national_centers_151.csv',
      'national_destinations.csv',
      'national_geo_outlets.csv',
    ]) {
      const buf = await readFile(join(transferDir, name));
      assert.equal(sha256(buf), NATIONAL_TRANSFER_HASHES[name], name);
    }

    const parts = (await readdir(transferDir))
      .filter((name) => name.startsWith('national_zip_routes.part-'))
      .sort();
    const merged = Buffer.concat(await Promise.all(parts.map((p) => readFile(join(transferDir, p)))));
    assert.equal(merged.length, 5048599);
    assert.equal(sha256(merged), NATIONAL_TRANSFER_HASHES['national_zip_routes.csv']);
  });

  it('preserves accepted universe counts', () => {
    assert.equal(NATIONAL_TRANSFER_COUNTS.systems, 9200);
    assert.equal(NATIONAL_TRANSFER_COUNTS.outlets, 17415);
    assert.equal(NATIONAL_TRANSFER_COUNTS.observedRoutingIdentifiers, 37865);
    assert.equal(NATIONAL_TRANSFER_COUNTS.statesPlusDc, 51);
    assert.equal(NATIONAL_TRANSFER_COUNTS.deterministicBytes, 7990411);
  });

  it('preserves route-class counts in generated constants', () => {
    assert.equal(ROUTE_CLASS_COUNTS.EXACT_IMLS_OUTLET_ZIP, 15300);
    assert.equal(ROUTE_CLASS_COUNTS.EXACT_IMLS_SYSTEM_ZIP, 49);
    assert.equal(ROUTE_CLASS_COUNTS.ZCTA_NEAREST_ACTIVE_OUTLET, 18536);
    assert.equal(ROUTE_CLASS_COUNTS.OBSERVED_REFERENCE_INDIRECT_ONLY, 3980);
  });
});

describe('P12-02 route classes', () => {
  it('routes exact IMLS outlet ZIP', async () => {
    const route = await lookupZipRoute('01001');
    assert.equal(route.routeClass, 'EXACT_IMLS_OUTLET_ZIP');
    const source = await buildNationalFallbackSource(route);
    const out = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '01001',
      locationMode: 'ZIP',
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => /official page to ask\/check/i.test(r.title)));
    assert.match(source.note, /Active IMLS outlet identity/i);
  });

  it('routes exact IMLS system/admin ZIP as non-physical', async () => {
    const route = await lookupZipRoute('05826');
    assert.equal(route.routeClass, 'EXACT_IMLS_SYSTEM_ZIP');
    const source = await buildNationalFallbackSource(route);
    assert.match(source.note, /not a physical nearby outlet/i);
  });

  it('routes ZCTA nearest outlet with distance', async () => {
    const route = await lookupZipRoute('00601');
    assert.equal(route.routeClass, 'ZCTA_NEAREST_ACTIVE_OUTLET');
    assert.ok(route.distanceKm > 1000);
    const out = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '00601',
      locationMode: 'ZIP',
    });
    assert.ok(out.results.some((r) => r.distanceLabel?.startsWith('Approx.')));
  });

  it('routes observed-reference indirect-only to IMLS Search & Compare', async () => {
    const route = await lookupZipRoute('96801');
    assert.equal(route.routeClass, 'OBSERVED_REFERENCE_INDIRECT_ONLY');
    const out = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '96801',
      locationMode: 'ZIP',
    });
    assert.ok(out.results.some((r) => /IMLS Search & Compare/i.test(r.title)));
  });
});

describe('P12-03 manual ZIP behavior', () => {
  it('keeps malformed ZIP invalid', () => {
    assert.equal(validateZip('12a45').status, 'INVALID');
    const out = search({ objectText: 'telescope', zip: '12a45' });
    assert.equal(out.status, 'error');
    assert.equal(out.message, MESSAGES.invalidZip);
  });

  it('routes unknown well-formed ZIP to IMLS Search & Compare', async () => {
    assert.equal(validateZip('99999').status, 'WELL_FORMED');
    const out = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '99999',
      locationMode: 'ZIP',
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => /IMLS Search & Compare/i.test(r.title)));
  });
});

describe('P12-04 Pass-011 regressions preserved', () => {
  it('Springfield MO specialist still outranks national fallback', () => {
    const out = search({ objectText: 'pressure washer', zip: '65807', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S7_SPRINGFIELD_TOOL_LIBRARY');
  });

  it('Mountain Home AR specialist still outranks national fallback', () => {
    const out = search({ objectText: 'fishing pole', zip: '72653', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'S9_BAXTER_SPECIAL_COLLECTIONS');
  });

  it('72730 manual ZIP stays conservative without Fayetteville fab lab', () => {
    const out = search({ objectText: '3D printer', zip: '72730', locationMode: 'ZIP' });
    assert.ok(!out.results.some((r) => r.sourceId === 'OZ_FAYETTEVILLE_FAB_LAB'));
  });

  it('local Ozarks specialist outranks national generic fallback', async () => {
    const out = search({ objectText: 'telescope', zip: '72758', locationMode: 'ZIP' });
    assert.equal(out.results[0].sourceId, 'OZ_ROGERS_TELESCOPE');
    const nationalOnly = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '10002',
      locationMode: 'ZIP',
    });
    assert.ok(nationalOnly.results.every((r) => r.class === RESULT_CLASS.FALLBACK));
  });
});

describe('P12-05 GEO national outlet layer', () => {
  it('finds deterministic nearest national outlet', async () => {
    const nearest = await findNearestNationalOutlet(61.2181, -149.9003);
    assert.ok(nearest);
    assert.ok(nearest.distanceKm >= 0);
    assert.equal(nearest.outlet.state, 'AK');
  });

  it('uses national outlet when no reviewed specialist geography applies', async () => {
    const target = await resolveGeoSearchTarget(40.7589, -73.9851, 'chainsaw');
    assert.equal(target.kind, 'national_outlet');
    assert.ok(target.zip);
    assert.equal(target.nationalRoute.routeClass, 'GEO_NEAREST_ACTIVE_OUTLET');
    const source = await buildNationalFallbackSource(target.nationalRoute);
    assert.match(source.note, /permissioned location/i);
    assert.doesNotMatch(source.note, /Census|ZCTA/i);
  });
});

describe('P12-06 representation and assets', () => {
  it('represents all 50 states plus DC', () => {
    assert.equal(NATIONAL_STATES.length, 51);
    assert.ok(NATIONAL_STATES.includes('DC'));
    assert.ok(NATIONAL_STATES.includes('AK'));
    assert.ok(NATIONAL_STATES.includes('HI'));
  });

  it('keeps generated assets practical for lazy loading', () => {
    assert.ok(NATIONAL_ASSET_BYTES.routeChunksTotal < 2_000_000);
    assert.ok(NATIONAL_ASSET_BYTES.routeChunkCount >= 90);
    assert.ok(NATIONAL_ASSET_BYTES.outletsJson > 0);
  });

  it('regenerates national assets deterministically', () => {
    execFileSync('node', ['scripts/generate-national-data.mjs'], { cwd: root });
    const constants = readFileSync(join(root, 'js', 'national', 'constants.js'));
    assert.match(constants.toString(), /15300/);
  });
});

describe('P12-07 privacy and recurring cost', () => {
  it('does not emit forbidden GA keys from national search', async () => {
    await searchWithNational(search, {
      objectText: 'telescope',
      zip: '10001',
      locationMode: 'ZIP',
    });
    const captured = [];
    const gtag = (_cmd, _name, payload) => captured.push(payload);
    bridgeEventToGa4(
      {
        type: 'results_rendered',
        counts: { RELEVANT: 0, RESOURCE: 0, FALLBACK: 1, NONE: 0 },
        zip: '10001',
        coordinates: 'secret',
      },
      gtag,
    );
    assert.equal(captured.length, 1);
    for (const key of FORBIDDEN_GA_KEYS) {
      assert.ok(!(key in captured[0]), key);
    }
  });

  it('does not add recurring cost infrastructure', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
    assert.ok(!getAllSources().some((s) => /available now|in stock/i.test(s.note || '')));
    assert.equal(SOURCES.length, 9);
  });
});

describe('P12-08 Primary correction 001', () => {
  it('C1: former noApprovedSource pilot ZIP 90210 gets national fallback', async () => {
    const out = await searchWithNational(search, {
      objectText: 'pressure washer',
      zip: '90210',
      locationMode: 'ZIP',
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.length >= 1);
    assert.notEqual(out.message, MESSAGES.invalidZip);
    assert.notEqual(out.message, MESSAGES.noNearbyEvidence);
  });

  it('C2: GEO nearest-outlet route uses permissioned-location semantics', async () => {
    const target = await resolveNationalGeoTarget(40.7589, -73.9851);
    assert.equal(target.kind, 'national_outlet');
    assert.equal(target.route.routeClass, 'GEO_NEAREST_ACTIVE_OUTLET');
    const source = await buildNationalFallbackSource(target.route);
    assert.match(source.note, /permissioned location/i);
    assert.doesNotMatch(source.note, /Census|ZCTA/i);
  });
});
