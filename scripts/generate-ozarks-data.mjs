#!/usr/bin/env node
/**
 * Deterministic Pass 011 conversion of transferred CSVs into static JS.
 * Does not edit source transfer rows.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packetDir = join(root, '.cibt', 'pass-011');
const outPath = join(root, 'js', 'ozarks-generated.js');

const EXPECTED = {
  'ozarks_city_filters.csv':
    '38917bb9fd9f14a9b4cf0feb0e69971949ad5d9b89bb3bf2cd2af21ec5eb206e',
  'ozarks_key_city_category_probes_85.csv':
    '8934f116c49ff733d44d92a2259fc44a3f3709bf8df4b84fe617ba02c4213ebd',
};

const MAKER_OBJECT_CLASSES = [
  'THREE_D_PRINTER',
  'THREE_D_SCANNER',
  'LASER_ENGRAVER',
  'VINYL_CUTTER',
  'SOLDERING_STATION',
  'VIDEO_TRANSFER_EQUIPMENT',
];

const PASS010_OWNED_CITIES = new Set(['Springfield|MO', 'Mountain Home|AR']);
const PASS010_OWNED_ZIPS = new Set([
  '65801',
  '65802',
  '65803',
  '65804',
  '65805',
  '65806',
  '65807',
  '65808',
  '65809',
  '65810',
  '65814',
  '65817',
  '65890',
  '65898',
  '65899',
  '72653',
]);

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const row = [];
  let field = '';
  let inQuotes = false;
  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row.splice(0, row.length));
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  return rows.slice(1).filter((r) => r.some((cell) => cell !== '')).map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = r[idx] ?? '';
    });
    return obj;
  });
}

function cityKey(city, state) {
  return `${city}|${state}`;
}

function zipScore(row) {
  let score = 0;
  if (row.is_key_city === '1') score += 8;
  if (row.specialist_override_state === 'specialist_supported') score += 4;
  if (row.destination_class === 'DIRECT_LIBRARY_SYSTEM') score += 3;
  if (row.destination_class === 'STATE_LIBRARY_FACILITY_PAGE') score += 2;
  if (row.destination_class === 'DIRECT_MUNICIPAL_LIBRARY_PAGE') score += 2;
  return score;
}

function fallbackNote(row) {
  const handoff =
    row.destination_handoff === 'indirect'
      ? 'This is an official place to ask/check, not a specific library holdings claim.'
      : 'This is an official library/resource page to ask/check.';
  return `${handoff} No selected-object relevance or current availability is asserted. The linked source is the final authority.`;
}

function fallbackTitle(row) {
  if (row.destination_class === 'STATE_LIBRARY_HOME_HANDOFF') {
    if (row.destination_url.includes('sos.mo.gov')) {
      return 'Missouri State Library — official page to ask/check';
    }
    if (row.destination_url.includes('library.arkansas.gov')) {
      return 'Arkansas State Library — official page to ask/check';
    }
    return 'Official state library page to ask/check';
  }
  if (row.nearest_outlet_name) {
    return `${titleCase(row.nearest_outlet_name)} — official page to ask/check`;
  }
  return `${row.city_filter_name}, ${row.state} library source — official page to ask/check`;
}

function titleCase(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function specialistFromProbe(probe, zip, routeCityKey, zipIsConflicting) {
  const key = `${probe.city}|${probe.state}|${probe.category_family}`;
  const reviewDate = probe.check_date || '2026-09-12';
  const url = probe.evidence_url || probe.fallback_url;
  const org = probe.fallback_org;
  const geography = zipIsConflicting
    ? { geographyZips: [], geographyCityKeys: [routeCityKey] }
    : { geographyZips: [zip], geographyCityKeys: [routeCityKey] };

  if (probe.status !== 'ACCEPTED_CANDIDATE') return null;
  if (PASS010_OWNED_CITIES.has(cityKey(probe.city, probe.state))) return null;

  if (key === 'Bentonville|AR|telescope_science') {
    return {
      id: 'OZ_BENTONVILLE_TELESCOPE',
      class: 'RELEVANT_BORROWING_PROGRAM',
      url,
      title: `${org} — Library of Things (telescope)`,
      ...geography,
      objectClasses: ['TELESCOPE'],
      note: 'Official Library of Things listing names telescope as a checkout category. Check the source for inventory and eligibility. This is not a current-inventory claim.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'telescope_science',
    };
  }
  if (key === 'Bentonville|AR|tools_home_repair') {
    return {
      id: 'OZ_BENTONVILLE_DIY_RESOURCE',
      class: 'REGIONAL_OR_SPECIALIST_RESOURCE',
      url,
      title: `${org} — Library of Things (DIY tools)`,
      ...geography,
      objectClasses: ['HOME_REPAIR_TOOL'],
      linkOnly: true,
      note: 'Official Library of Things listing names DIY tools as a category. That does not prove a specific tool (for example a pressure washer) is offered or currently available. Check the source.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'tools_home_repair',
    };
  }
  if (key === 'Bentonville|AR|maker_technology') {
    return {
      id: 'OZ_BENTONVILLE_MAKERSPACE',
      class: 'REGIONAL_OR_SPECIALIST_RESOURCE',
      url,
      title: `${org} — BPL Makerspace`,
      ...geography,
      objectClasses: [...MAKER_OBJECT_CLASSES],
      onsiteResource: true,
      note: 'Official makerspace page retrieved. On-site equipment access is not evidence a selected object is present to borrow at query time. Check the source for access rules.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'maker_technology',
    };
  }
  if (key === 'Fayetteville|AR|maker_technology') {
    return {
      id: 'OZ_FAYETTEVILLE_FAB_LAB',
      class: 'REGIONAL_OR_SPECIALIST_RESOURCE',
      url,
      title: `${org} — Fabrication & Robotics Lab`,
      ...geography,
      objectClasses: [...MAKER_OBJECT_CLASSES],
      onsiteResource: true,
      note: 'Official Fabrication & Robotics Lab page retrieved. Access rules remain on the source page. This is not a current-availability or take-home inventory claim.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'maker_technology',
    };
  }
  if (key === 'Rogers|AR|telescope_science') {
    return {
      id: 'OZ_ROGERS_TELESCOPE',
      class: 'RELEVANT_BORROWING_PROGRAM',
      url,
      title: `${org} — telescope checkout`,
      ...geography,
      objectClasses: ['TELESCOPE'],
      note: 'Official telescope checkout page retrieved. Eligibility and current availability remain on the source page.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'telescope_science',
    };
  }
  if (key === 'Harrison|AR|telescope_science') {
    return {
      id: 'OZ_HARRISON_TELESCOPE',
      class: 'RELEVANT_BORROWING_PROGRAM',
      url,
      title: `${org} — telescope lending program`,
      ...geography,
      objectClasses: ['TELESCOPE'],
      note: 'Official telescope lending program page retrieved. Check the source for current availability and eligibility.',
      reviewDate,
      probeStatus: 'ACCEPTED_CANDIDATE',
      categoryFamily: 'telescope_science',
    };
  }

  return null;
}

function jsString(value) {
  return JSON.stringify(value);
}

const cityBytes = readFileSync(join(packetDir, 'ozarks_city_filters.csv'));
const probeBytes = readFileSync(join(packetDir, 'ozarks_key_city_category_probes_85.csv'));
const cityHash = sha256(cityBytes);
const probeHash = sha256(probeBytes);

if (cityHash !== EXPECTED['ozarks_city_filters.csv']) {
  throw new Error(`city CSV hash mismatch: ${cityHash}`);
}
if (probeHash !== EXPECTED['ozarks_key_city_category_probes_85.csv']) {
  throw new Error(`probe CSV hash mismatch: ${probeHash}`);
}

const cities = parseCsv(cityBytes.toString('utf8'));
const probes = parseCsv(probeBytes.toString('utf8'));

if (cities.length !== 76) throw new Error(`expected 76 city rows, got ${cities.length}`);
if (probes.length !== 85) throw new Error(`expected 85 probe rows, got ${probes.length}`);

const eligible = cities.filter((r) => r.product_route_eligible === 'true');
const holds = cities.filter((r) => r.product_route_eligible !== 'true');
if (eligible.length !== 75) throw new Error(`expected 75 eligible, got ${eligible.length}`);
if (holds.length !== 1 || holds[0].city_filter_name !== 'Eureka' || holds[0].state !== 'AR') {
  throw new Error('Eureka AR REVIEW_HOLD contract broken');
}

const zipGroups = new Map();
for (const row of eligible) {
  const zip = row.representative_zip;
  if (!zip) continue;
  if (!zipGroups.has(zip)) zipGroups.set(zip, []);
  zipGroups.get(zip).push(row);
}

const sharedRepresentativeZips = {};
for (const [zip, rows] of zipGroups) {
  if (rows.length < 2) continue;
  const urls = [...new Set(rows.map((r) => r.destination_url))];
  const hasSpecialistSupported = rows.some(
    (r) => r.specialist_override_state === 'specialist_supported',
  );
  const conflicting = hasSpecialistSupported && urls.length > 1;
  sharedRepresentativeZips[zip] = {
    kind: conflicting ? 'conflicting' : 'destination_equivalent',
    cities: rows.map((r) => `${r.city_filter_name}, ${r.state}`),
    destinationUrls: urls,
  };
}

const conflictingZips = new Set(
  Object.entries(sharedRepresentativeZips)
    .filter(([, meta]) => meta.kind === 'conflicting')
    .map(([zip]) => zip),
);

const zipOwners = new Map();
for (const row of eligible) {
  const zip = row.representative_zip;
  if (conflictingZips.has(zip)) continue;
  const prev = zipOwners.get(zip);
  if (!prev || zipScore(row) > zipScore(prev)) zipOwners.set(zip, row);
}

const ozarksZipCentroids = {};
const ozarksCities = [];
const fallbackSources = [];
const skippedFallbackZips = [];

for (const row of cities) {
  const key = cityKey(row.city_filter_name, row.state);
  const eligibleRoute = row.product_route_eligible === 'true';
  const lat = row.intpt_lat ? Number(row.intpt_lat) : null;
  const lon = row.intpt_lon ? Number(row.intpt_lon) : null;
  ozarksCities.push({
    key,
    city: row.city_filter_name,
    state: row.state,
    productRouteEligible: eligibleRoute,
    reviewHold: row.usefulness_completeness === 'REVIEW_HOLD',
    representativeZip: row.representative_zip || null,
    lat,
    lon,
    destinationUrl: row.destination_url || null,
    destinationClass: row.destination_class || null,
    specialistOverrideState: row.specialist_override_state,
    holdNote: row.hold_note || '',
  });
}

for (const [zip, rows] of zipGroups) {
  if (PASS010_OWNED_ZIPS.has(zip)) {
    skippedFallbackZips.push(zip);
    continue;
  }
  if (rows.every((r) => PASS010_OWNED_CITIES.has(cityKey(r.city_filter_name, r.state)))) {
    continue;
  }

  if (conflictingZips.has(zip)) {
    const lats = rows.map((r) => Number(r.intpt_lat)).filter((n) => Number.isFinite(n));
    const lons = rows.map((r) => Number(r.intpt_lon)).filter((n) => Number.isFinite(n));
    const conservative = rows.find((r) => r.destination_class === 'STATE_LIBRARY_HOME_HANDOFF') || rows[0];
    const cityNames = rows.map((r) => r.city_filter_name).join(', ');
    ozarksZipCentroids[zip] = {
      label: `${cityNames}, ${conservative.state} (shared ZIP routing context)`,
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lon: lons.reduce((a, b) => a + b, 0) / lons.length,
      ozarksCityKey: null,
      routingContext: true,
      ambiguousSharedZip: true,
    };
    fallbackSources.push({
      id: `OZ_FALLBACK_SHARED_${zip}`,
      class: 'NEARBY_LIBRARY_TO_ASK',
      url: conservative.destination_url,
      title: fallbackTitle(conservative),
      geographyZips: [zip],
      geographyCityKeys: [],
      objectClasses: null,
      objectRelevance: 'NONE_ASSERTED',
      note: `${fallbackNote(conservative)} This ZIP is shared by more than one reviewed city, so this is a conservative official page to ask/check — not a city-specific specialist claim.`,
      reviewDate: conservative.check_date || '2026-09-12',
      probeStatus: 'FALLBACK',
      destinationClass: conservative.destination_class,
      cityKey: null,
      sharedZip: zip,
    });
    continue;
  }

  const owner = zipOwners.get(zip);
  if (!owner) continue;
  if (PASS010_OWNED_CITIES.has(cityKey(owner.city_filter_name, owner.state))) continue;

  const ownerKey = cityKey(owner.city_filter_name, owner.state);
  ozarksZipCentroids[zip] = {
    label: `${owner.city_filter_name}, ${owner.state}`,
    lat: Number(owner.intpt_lat),
    lon: Number(owner.intpt_lon),
    ozarksCityKey: ownerKey,
    routingContext: true,
  };

  fallbackSources.push({
    id: `OZ_FALLBACK_${owner.filter_id}_${owner.state}_${owner.city_filter_name.replace(/\s+/g, '_').toUpperCase()}`,
    class: 'NEARBY_LIBRARY_TO_ASK',
    url: owner.destination_url,
    title: fallbackTitle(owner),
    geographyZips: [zip],
    objectClasses: null,
    objectRelevance: 'NONE_ASSERTED',
    note: fallbackNote(owner),
    reviewDate: owner.check_date || '2026-09-12',
    probeStatus: 'FALLBACK',
    destinationClass: owner.destination_class,
    cityKey: ownerKey,
  });
}

const specialistSources = [];
const unpublished = { HOLD: 0, CANDIDATE: 0, ACCEPTED_SKIPPED_PASS010: 0, FALLBACK: 0 };

for (const probe of probes) {
  if (probe.status === 'HOLD') {
    unpublished.HOLD += 1;
    continue;
  }
  if (probe.status === 'CANDIDATE') {
    unpublished.CANDIDATE += 1;
    continue;
  }
  if (probe.status === 'FALLBACK') {
    unpublished.FALLBACK += 1;
    continue;
  }
  if (PASS010_OWNED_CITIES.has(cityKey(probe.city, probe.state))) {
    unpublished.ACCEPTED_SKIPPED_PASS010 += 1;
    continue;
  }
  const cityRow = eligible.find(
    (r) => r.city_filter_name === probe.city && r.state === probe.state,
  );
  if (!cityRow) continue;
  const routeCityKey = cityKey(probe.city, probe.state);
  const spec = specialistFromProbe(
    probe,
    cityRow.representative_zip,
    routeCityKey,
    conflictingZips.has(cityRow.representative_zip),
  );
  if (spec) specialistSources.push(spec);
}

const ozarksSources = [...specialistSources, ...fallbackSources];

const file = `/** Generated by scripts/generate-ozarks-data.mjs — do not edit by hand. */
export const OZARKS_TRANSFER_HASHES = {
  'ozarks_city_filters.csv': ${jsString(cityHash)},
  'ozarks_key_city_category_probes_85.csv': ${jsString(probeHash)},
};

export const OZARKS_TRANSFER_COUNTS = {
  cityRows: ${cities.length},
  routeEligible: ${eligible.length},
  reviewHold: ${holds.length},
  probeRows: ${probes.length},
  zipCentroids: ${Object.keys(ozarksZipCentroids).length},
  fallbackSources: ${fallbackSources.length},
  specialistSources: ${specialistSources.length},
  unpublishedHoldProbes: ${unpublished.HOLD},
  unpublishedCandidateProbes: ${unpublished.CANDIDATE},
  unpublishedFallbackProbes: ${unpublished.FALLBACK},
  acceptedCandidateSkippedPass010: ${unpublished.ACCEPTED_SKIPPED_PASS010},
  sharedRepresentativeZips: ${Object.keys(sharedRepresentativeZips).length},
  conflictingSharedZips: ${conflictingZips.size},
};

export const OZARKS_SHARED_REPRESENTATIVE_ZIPS = ${JSON.stringify(sharedRepresentativeZips, null, 2)};

export const OZARKS_CITIES = ${JSON.stringify(ozarksCities, null, 2)};

export const OZARKS_ZIP_CENTROIDS = ${JSON.stringify(ozarksZipCentroids, null, 2)};

export const OZARKS_SOURCES = ${JSON.stringify(ozarksSources, null, 2)};
`;

writeFileSync(outPath, file);
console.log(`wrote ${outPath}`);
console.log(JSON.stringify({ cityHash, probeHash, ...JSON.parse(JSON.stringify({
  cities: cities.length,
  eligible: eligible.length,
  zips: Object.keys(ozarksZipCentroids).length,
  fallbacks: fallbackSources.length,
  specialists: specialistSources.map((s) => s.id),
  unpublished,
})) }, null, 2));
