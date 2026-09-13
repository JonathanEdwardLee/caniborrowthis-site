import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { search, MESSAGES } from '../../js/search.js';
import { validateZip, resolveGeoSearchTarget, getOzarksCity } from '../../js/geo.js';
import { RESULT_CLASS, getAllSources, PILOT_ZIPS } from '../../js/data.js';
import { bridgeEventToGa4, FORBIDDEN_GA_KEYS } from '../../js/measure.js';
import {
  buildNationalFallbackSource,
  lookupZipRoute,
} from '../../js/national-routing.js';
import { searchWithNational, preloadNationalData } from './national.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const MATRIX_PATH = join(root, '.cibt', 'pass-012', 'transfer', 'national_centers_151.csv');
export const MATRIX_SHA256 = '7730850bb716803b4186bdd334eb0df12b566326edc3c8b676f751e8c4e18ee7';
export const MATRIX_BYTES = 74992;
export const CENTER_COUNT = 151;
export const CATEGORY_COUNT = 5;
export const PROBE_COUNT = CENTER_COUNT * CATEGORY_COUNT;

export const CATEGORIES = [
  { id: 'telescope/science', objectText: 'telescope' },
  { id: 'tools/home repair', objectText: 'pressure washer' },
  { id: 'maker/technology', objectText: '3D printer' },
  { id: 'music/hobby', objectText: 'guitar' },
  { id: 'outdoor/recreation', objectText: 'fishing pole' },
];

export const AVAILABILITY_CLAIM =
  /available now|in stock|currently available to borrow|on the shelf now/i;

const SPECIALIST_IDS = new Set(
  getAllSources()
    .filter((s) => s.class === RESULT_CLASS.RELEVANT || (s.class === RESULT_CLASS.RESOURCE && !s.national))
    .map((s) => s.id),
);

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      if (field.length || row.length) {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      }
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}

export function proveMatrixIdentity() {
  const buf = readFileSync(MATRIX_PATH);
  const digest = sha256(buf);
  return {
    bytes: buf.length,
    sha256: digest,
    bytesOk: buf.length === MATRIX_BYTES,
    shaOk: digest === MATRIX_SHA256,
  };
}

function collectText(out) {
  const parts = [out.message, ...(out.disclaimers || [])];
  for (const r of out.results || []) {
    parts.push(r.title, r.note, r.classLabel, r.usageNote, r.distanceLabel, r.objectRelevance);
  }
  return parts.filter(Boolean).join('\n');
}

function failuresFromZipProbe(center, category, zipStatus, out) {
  const failures = [];
  const label = `${center.state}|${center.place_name}|${center.test_zcta}|${category.id}`;
  if (zipStatus === 'INVALID') {
    failures.push(`${label}: representative ZIP not treated as well-formed`);
  }
  if (out.status === 'error' && out.message === MESSAGES.invalidZip) {
    failures.push(`${label}: old invalid-ZIP / pilot limitation blocked national routing`);
  }
  if (out.status !== 'ok' || !out.results?.length) {
    failures.push(`${label}: no honest official source/fallback returned`);
  }
  const blob = collectText(out);
  if (AVAILABILITY_CLAIM.test(blob)) {
    failures.push(`${label}: unsupported availability claim`);
  }
  for (const r of out.results || []) {
    if (r.class === RESULT_CLASS.FALLBACK && r.objectRelevance && r.objectRelevance !== 'NONE_ASSERTED') {
      failures.push(`${label}: generic fallback asserts object relevance (${r.sourceId})`);
    }
    if (r.class === RESULT_CLASS.FALLBACK && /selected object is available|this object is available/i.test(`${r.title}\n${r.note}`)) {
      failures.push(`${label}: generic fallback implies selected-object availability`);
    }
    const isSpecialist = SPECIALIST_IDS.has(r.sourceId) || r.class === RESULT_CLASS.RELEVANT;
    const zipInfo = PILOT_ZIPS[center.test_zcta];
    const geoMatch = zipInfo && (zipInfo.ozarksCityKey || zipInfo.label);
    if (isSpecialist && r.class === RESULT_CLASS.RELEVANT && !geoMatch && !PILOT_ZIPS[center.test_zcta]) {
      failures.push(`${label}: specialist/object-specific result without accepted local evidence (${r.sourceId})`);
    }
  }
  const first = out.results?.[0];
  if (first?.sourceId?.startsWith('NAT_') && out.results.some((r) => SPECIALIST_IDS.has(r.sourceId))) {
    failures.push(`${label}: national generic fallback outranked accepted specialist`);
  }
  return failures;
}

async function zipSearch(objectText, zip) {
  return searchWithNational(search, { objectText, zip, locationMode: 'ZIP' });
}

async function geoSearch(objectText, lat, lon) {
  const target = await resolveGeoSearchTarget(lat, lon, objectText);
  if (target.kind === 'national_outlet') {
    const source = await buildNationalFallbackSource(target.nationalRoute);
    const out = search({
      objectText,
      zip: target.zip,
      locationMode: 'GEO',
      geoDistanceMi: target.distanceMi,
      geoTargetKind: 'national_outlet',
      nationalZipContext: {
        kind: 'observed',
        zip: target.zip,
        route: target.nationalRoute,
        source,
      },
      nationalRoute: target.nationalRoute,
    });
    return { target, out };
  }
  if (target.kind === 'zip') {
    const out = await zipSearch(objectText, target.zip);
    out.geoDistanceMi = target.distanceMi;
    return { target, out };
  }
  if (target.kind === 'national') {
    const out = search({
      objectText,
      zip: '',
      locationMode: 'GEO',
      geoTargetKind: 'national',
    });
    return { target, out };
  }
  const out = search({
    objectText,
    zip: '',
    locationMode: 'GEO',
    geoTargetKind: 'no_zip',
  });
  return { target, out };
}

function failuresFromGeo(center, target, out) {
  const failures = [];
  const label = `GEO|${center.state}|${center.place_name}`;
  if (!target || target.kind === 'no_zip') {
    failures.push(`${label}: nearest-outlet / GEO routing did not resolve`);
  }
  const blob = collectText(out);
  if (AVAILABILITY_CLAIM.test(blob)) {
    failures.push(`${label}: unsupported availability claim`);
  }
  if (/reverse[- ]?geocod/i.test(blob)) {
    failures.push(`${label}: false reverse-geocoded ZIP display`);
  }
  if (target.kind === 'national_outlet') {
    if (!/permissioned location/i.test(blob)) {
      failures.push(`${label}: wording does not reflect permissioned-location context`);
    }
    if (/Census|ZCTA/i.test(blob)) {
      failures.push(`${label}: GEO wording leaked Census/ZCTA ZIP semantics`);
    }
    if (/inventory proof|eligibility proof|in stock/i.test(blob) && !/not eligibility|not .*inventory proof/i.test(blob)) {
      failures.push(`${label}: nearest outlet implied eligibility/inventory proof`);
    }
  }
  if (out.status !== 'ok' || (target.kind !== 'national' && !out.results?.length)) {
    if (target.kind !== 'national' || !out.results?.length) {
      if (target.kind !== 'national') {
        failures.push(`${label}: no source/place to check returned`);
      }
    }
  }
  return failures;
}

function tagCenter(center) {
  const tags = [];
  const pop = Number(center.pop_acs2024_5yr_b01003);
  const outletKm = Number(center.nearest_outlet_km);
  if (pop >= 500000) tags.push('dense_urban');
  if (pop < 50000 || outletKm > 40) tags.push('sparse_rural');
  if (center.state === 'DC') tags.push('state_border');
  if (center.state === 'AK') tags.push('alaska_long_distance');
  if (center.state === 'HI') tags.push('hawaii_island');
  if (/Springfield city, Missouri/i.test(center.place_name)) tags.push('springfield_mo');
  if (/Mountain Home/i.test(center.place_name)) tags.push('mountain_home_ar');
  return tags;
}

export async function runPass013Verification() {
  const matrix = proveMatrixIdentity();
  if (!matrix.bytesOk || !matrix.shaOk) {
    throw new Error(`matrix identity mismatch: bytes=${matrix.bytes} sha=${matrix.sha256}`);
  }

  await preloadNationalData();
  const centers = parseCsv(readFileSync(MATRIX_PATH, 'utf8'));
  if (centers.length !== CENTER_COUNT) {
    throw new Error(`expected ${CENTER_COUNT} centers, got ${centers.length}`);
  }

  const zipProbes = [];
  const geoRows = [];
  const failures = [];
  let pass = 0;
  let fail = 0;
  let hold = 0;

  for (const center of centers) {
    const zip = center.test_zcta;
    const zipStatus = validateZip(zip).status;
    for (const category of CATEGORIES) {
      const out = await zipSearch(category.objectText, zip);
      const probeFailures = failuresFromZipProbe(center, category, zipStatus, out);
      const status = probeFailures.length ? 'FAIL' : 'PASS';
      if (status === 'PASS') pass += 1;
      else {
        fail += 1;
        failures.push(...probeFailures);
      }
      zipProbes.push({
        geoId: center.geo_id,
        state: center.state,
        place: center.place_name,
        zip,
        zipStatus,
        category: category.id,
        objectText: category.objectText,
        status,
        resultCount: out.results?.length || 0,
        firstSource: out.results?.[0]?.sourceId || null,
        firstClass: out.results?.[0]?.class || null,
        failures: probeFailures,
      });
    }

    const lat = Number(center.place_intpt_lat);
    const lon = Number(center.place_intpt_lon);
    const { target, out } = await geoSearch('ukulele', lat, lon);
    const geoFailures = failuresFromGeo(center, target, out);
    const status = geoFailures.length ? 'FAIL' : 'PASS';
    if (status === 'PASS') pass += 1;
    else {
      fail += 1;
      failures.push(...geoFailures);
    }
    geoRows.push({
      geoId: center.geo_id,
      state: center.state,
      place: center.place_name,
      tags: tagCenter(center),
      lat,
      lon,
      targetKind: target?.kind || null,
      targetZip: target?.zip || null,
      targetLabel: target?.label || null,
      routeClass: target?.nationalRoute?.routeClass || target?.route?.routeClass || null,
      status,
      failures: geoFailures,
    });
  }

  const malformed = search({ objectText: 'telescope', zip: '12a45' });
  const unknown = await zipSearch('telescope', '99999');
  const zip90210 = await zipSearch('pressure washer', '90210');
  const zip72730 = await zipSearch('3D printer', '72730');
  const springfield = await zipSearch('pressure washer', '65807');
  const mountainHome = await zipSearch('fishing pole', '72653');
  const eureka = getOzarksCity('Eureka', 'AR');
  const eurekaSprings = getOzarksCity('Eureka Springs', 'AR');
  const eurekaSpringsOut = await zipSearch('telescope', '72632');

  const edges = [];
  function edge(name, ok, detail) {
    if (!ok) {
      fail += 1;
      failures.push(`edge:${name}: ${detail}`);
    } else {
      pass += 1;
    }
    edges.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  }

  edge('malformed_zip_distinct', malformed.status === 'error' && malformed.message === MESSAGES.invalidZip, malformed.message);
  edge(
    'unknown_well_formed_zip',
    unknown.status === 'ok' && unknown.results.some((r) => /IMLS Search & Compare/i.test(r.title)) && unknown.message !== MESSAGES.invalidZip,
    unknown.results[0]?.title,
  );
  edge(
    'former_no_source_90210',
    zip90210.status === 'ok' && zip90210.results.length >= 1 && zip90210.message !== MESSAGES.invalidZip && zip90210.message !== MESSAGES.noNearbyEvidence,
    zip90210.results[0]?.sourceId,
  );
  edge(
    '72730_conservative',
    zip72730.status === 'ok' && !zip72730.results.some((r) => r.sourceId === 'OZ_FAYETTEVILLE_FAB_LAB'),
    zip72730.results.map((r) => r.sourceId).join(','),
  );
  edge(
    'springfield_mo_specialist',
    springfield.results[0]?.sourceId === 'S7_SPRINGFIELD_TOOL_LIBRARY',
    springfield.results[0]?.sourceId,
  );
  edge(
    'mountain_home_ar_specialist',
    mountainHome.results[0]?.sourceId === 'S9_BAXTER_SPECIAL_COLLECTIONS',
    mountainHome.results[0]?.sourceId,
  );
  edge(
    'eureka_ar_hold',
    Boolean(eureka?.reviewHold) && eureka.productRouteEligible === false && eureka.representativeZip == null && eureka.lat == null,
    JSON.stringify({ eligible: eureka?.productRouteEligible, zip: eureka?.representativeZip }),
  );
  edge(
    'eureka_springs_distinct',
    eurekaSprings?.productRouteEligible === true &&
      eurekaSprings.representativeZip === '72632' &&
      eurekaSpringsOut.results.some((r) => /Eureka Springs|Arkansas State Library/i.test(r.title)),
    eurekaSpringsOut.results[0]?.title,
  );

  const nyc = geoRows.find((r) => r.state === 'NY' && /New York city/i.test(r.place));
  const chicago = geoRows.find((r) => r.state === 'IL' && /Chicago/i.test(r.place));
  const dc = geoRows.find((r) => r.state === 'DC');
  const ak = geoRows.find((r) => r.state === 'AK');
  const hi = geoRows.find((r) => r.state === 'HI');
  const springfieldGeo = geoRows.find((r) => r.tags.includes('springfield_mo'));
  const sparse = geoRows.filter((r) => r.tags.includes('sparse_rural'));

  edge('dense_urban_nyc', nyc?.status === 'PASS' && nyc.targetKind != null, nyc?.targetKind);
  edge('dense_urban_chicago', chicago?.status === 'PASS', chicago?.targetKind);
  edge('state_border_dc', dc?.status === 'PASS', dc?.targetKind);
  edge('alaska_long_distance', ak?.status === 'PASS', ak?.targetKind);
  edge('hawaii_island', hi?.status === 'PASS', hi?.targetKind);
  edge('springfield_mo_geo', springfieldGeo?.status === 'PASS', springfieldGeo?.targetKind);
  edge('sparse_rural_sample', sparse.length > 0 && sparse.every((r) => r.status === 'PASS'), `sparse_n=${sparse.length}`);

  const captured = [];
  const gtag = (_cmd, _name, payload) => captured.push(payload);
  bridgeEventToGa4(
    {
      type: 'search_submitted',
      objectClass: 'TELESCOPE',
      locationMode: 'ZIP',
      coverageState: 'SUPPORTED',
      zip: '10001',
      rawObject: 'telescope',
      objectText: 'telescope',
      coordinates: '40.7,-74.0',
      latitude: 40.7,
      longitude: -74.0,
      query: 'secret',
      searchText: 'secret',
    },
    gtag,
  );
  const gaKeys = captured[0] ? Object.keys(captured[0]) : [];
  const gaLeak = FORBIDDEN_GA_KEYS.filter((k) => gaKeys.includes(k));
  edge('ga_privacy_boundary', captured.length === 1 && gaLeak.length === 0, gaKeys.join(','));

  const availabilityHits = [...zipProbes, ...geoRows].filter((row) =>
    (row.failures || []).some((f) => /availability claim/i.test(f)),
  );
  edge('zero_unsupported_availability_claims', availabilityHits.length === 0, `hits=${availabilityHits.length}`);

  const report = {
    generated: new Date().toISOString(),
    matrix,
    centerCount: centers.length,
    zipProbeCount: zipProbes.length,
    expectedZipProbes: PROBE_COUNT,
    geoCount: geoRows.length,
    zipPass: zipProbes.filter((p) => p.status === 'PASS').length,
    zipFail: zipProbes.filter((p) => p.status === 'FAIL').length,
    geoPass: geoRows.filter((p) => p.status === 'PASS').length,
    geoFail: geoRows.filter((p) => p.status === 'FAIL').length,
    edgePass: edges.filter((e) => e.status === 'PASS').length,
    edgeFail: edges.filter((e) => e.status === 'FAIL').length,
    pass,
    fail,
    hold,
    failures,
    edges,
    firstCohort: zipProbes.filter((p) => p.state === 'DC' || p.state === 'AK' || p.state === 'HI').length,
    recurringCostDelta: 0,
  };

  return { report, zipProbes, geoRows, centers };
}

export function writeEvidence({ report, zipProbes, geoRows }) {
  const dir = join(root, '.cibt', 'pass-013', 'evidence');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pass013-summary.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, 'pass013-zip-probes.json'), `${JSON.stringify(zipProbes, null, 2)}\n`);
  writeFileSync(join(dir, 'pass013-geo.json'), `${JSON.stringify(geoRows, null, 2)}\n`);
  return dir;
}
