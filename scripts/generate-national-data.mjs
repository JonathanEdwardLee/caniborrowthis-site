#!/usr/bin/env node
/**
 * Deterministic Pass 012 conversion of accepted national transfer CSVs into static assets.
 * Does not edit source transfer rows.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packetDir = join(root, '.cibt', 'pass-012', 'transfer');
const outDir = join(root, 'js', 'national');

const EXPECTED_HASHES = {
  'national_centers_151.csv':
    '7730850bb716803b4186bdd334eb0df12b566326edc3c8b676f751e8c4e18ee7',
  'national_destinations.csv':
    '0ad7ff3b0869c567f1e70a01551b209a19df81a15899b068202fbeb44c1cba42',
  'national_geo_outlets.csv':
    '738a7fdd6703a51beb854725076484ba1938d17afc0a95c2441d55eb298c6bfc',
  'national_transfer_manifest.json':
    'c0fc6e440ac9073e2fc7d09fd333d20a90b6deb305e03ba127e6314587b42a21',
  'national_zip_routes.csv':
    '0ed4e3389a6938a28a8d0b963589488d53884327f207a34e52405bdea466b5f7',
};

const ROUTE_CLASS_CODE = {
  EXACT_IMLS_OUTLET_ZIP: 'E',
  EXACT_IMLS_SYSTEM_ZIP: 'S',
  ZCTA_NEAREST_ACTIVE_OUTLET: 'Z',
  OBSERVED_REFERENCE_INDIRECT_ONLY: 'I',
};

const ROUTE_CLASS_FROM_CODE = Object.fromEntries(
  Object.entries(ROUTE_CLASS_CODE).map(([k, v]) => [v, k]),
);

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
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push([...row]);
      row.length = 0;
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, idx) => [key, cells[idx] ?? ''])),
  );
}

function readVerified(name) {
  const path = join(packetDir, name);
  const buf = readFileSync(path);
  const hash = sha256(buf);
  const expected = EXPECTED_HASHES[name];
  if (expected && hash !== expected) {
    throw new Error(`${name} hash mismatch: got ${hash}, expected ${expected}`);
  }
  return buf;
}

function reconstructZipRoutes() {
  const splitMeta = JSON.parse(
    readFileSync(join(packetDir, 'national_zip_routes.split.json'), 'utf8'),
  );
  const parts = readdirSync(packetDir)
    .filter((name) => name.startsWith('national_zip_routes.part-'))
    .sort();
  if (parts.length !== splitMeta.part_count) {
    throw new Error(`expected ${splitMeta.part_count} route parts, got ${parts.length}`);
  }
  const chunks = parts.map((name) => readFileSync(join(packetDir, name)));
  const merged = Buffer.concat(chunks);
  if (merged.length !== splitMeta.source_bytes) {
    throw new Error(`route byte count mismatch: ${merged.length} != ${splitMeta.source_bytes}`);
  }
  const hash = sha256(merged);
  if (hash !== splitMeta.source_sha256) {
    throw new Error(`route hash mismatch: ${hash}`);
  }
  return merged.toString('utf8');
}

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'routes'), { recursive: true });

readVerified('national_centers_151.csv');
readVerified('national_destinations.csv');
readVerified('national_geo_outlets.csv');
readVerified('national_transfer_manifest.json');

const manifest = JSON.parse(readVerified('national_transfer_manifest.json').toString('utf8'));
const routeText = reconstructZipRoutes();
const routeRows = csvToObjects(routeText);
const destinationRows = csvToObjects(readVerified('national_destinations.csv').toString('utf8'));
const outletRows = csvToObjects(readVerified('national_geo_outlets.csv').toString('utf8'));

if (routeRows.length !== manifest.row_counts['national_zip_routes.csv']) {
  throw new Error(`route row count mismatch: ${routeRows.length}`);
}
if (destinationRows.length !== manifest.row_counts['national_destinations.csv']) {
  throw new Error(`destination row count mismatch: ${destinationRows.length}`);
}
if (outletRows.length !== manifest.row_counts['national_geo_outlets.csv']) {
  throw new Error(`outlet row count mismatch: ${outletRows.length}`);
}

const routeClassCounts = {};
for (const row of routeRows) {
  routeClassCounts[row.route_class] = (routeClassCounts[row.route_class] || 0) + 1;
}
for (const [cls, count] of Object.entries(manifest.route_class_counts)) {
  if (routeClassCounts[cls] !== count) {
    throw new Error(`route class ${cls}: expected ${count}, got ${routeClassCounts[cls]}`);
  }
}

const destinations = {};
for (const row of destinationRows) {
  destinations[row.fscskey] = {
    libname: row.libname,
    city: row.city,
    state: row.state,
    zip: row.zip,
    url: row.destination_url,
    destinationClass: row.destination_class,
    handoff: row.destination_handoff,
    rights: row.destination_rights,
    reviewDate: row.destination_check_date,
  };
}

const outlets = {};
for (const row of outletRows) {
  const key = `${row.fscskey}|${row.fscs_seq}`;
  outlets[key] = {
    fscskey: row.fscskey,
    fscsSeq: row.fscs_seq,
    libname: row.libname,
    city: row.city,
    state: row.state,
    zip: row.zip,
    lat: Number(row.lat),
    lon: Number(row.lon),
    outletType: row.outlet_type,
  };
}

const statesRepresented = new Set(destinationRows.map((row) => row.state));

const routeBuckets = {};
for (const row of routeRows) {
  const prefix = row.input_zip.slice(0, 2);
  if (!routeBuckets[prefix]) routeBuckets[prefix] = {};
  const code = ROUTE_CLASS_CODE[row.route_class];
  if (!code) throw new Error(`unknown route class ${row.route_class}`);
  const entry = { c: code, k: row.fscskey || null, s: row.fscs_seq || null };
  if (row.distance_km) entry.d = Number(row.distance_km);
  routeBuckets[prefix][row.input_zip] = entry;
}

let routeChunkBytes = 0;
for (const [prefix, bucket] of Object.entries(routeBuckets)) {
  const json = JSON.stringify(bucket);
  routeChunkBytes += json.length;
  writeFileSync(join(outDir, 'routes', `${prefix}.json`), json);
}

const destinationsJson = JSON.stringify(destinations);
const outletsJson = JSON.stringify(outlets);
writeFileSync(join(outDir, 'destinations.json'), destinationsJson);
writeFileSync(join(outDir, 'outlets.json'), outletsJson);

const constants = `/** Generated by scripts/generate-national-data.mjs — do not edit. */
export const IMLS_SEARCH_COMPARE_URL = ${JSON.stringify(manifest.imls_search_compare)};
export const NATIONAL_REVIEW_DATE = ${JSON.stringify(manifest.check_date)};
export const NATIONAL_PACKET = ${JSON.stringify(manifest.packet)};
export const ROUTE_CLASS = ${JSON.stringify(ROUTE_CLASS_FROM_CODE)};
export const ROUTE_CLASS_COUNTS = ${JSON.stringify(manifest.route_class_counts)};
export const NATIONAL_TRANSFER_COUNTS = {
  systems: ${manifest.accepted_system_count},
  outlets: ${manifest.accepted_outlet_count},
  observedRoutingIdentifiers: ${manifest.observed_zip_reference_count},
  zctas: ${manifest.zcta_count},
  centers: ${manifest.national_center_count},
  statesPlusDc: ${manifest.states_plus_dc_represented},
  deterministicBytes: ${manifest.total_deterministic_bytes},
};
export const NATIONAL_TRANSFER_HASHES = ${JSON.stringify(EXPECTED_HASHES)};
export const NATIONAL_STATES = ${JSON.stringify([...statesRepresented].sort())};
export const NATIONAL_ASSET_BYTES = {
  destinationsJson: ${destinationsJson.length},
  outletsJson: ${outletsJson.length},
  routeChunksTotal: ${routeChunkBytes},
  routeChunkCount: ${Object.keys(routeBuckets).length},
};
`;

writeFileSync(join(outDir, 'constants.js'), constants);

console.log('Generated national static assets:');
console.log(`  destinations.json: ${destinationsJson.length} bytes`);
console.log(`  outlets.json: ${outletsJson.length} bytes`);
console.log(`  route chunks: ${Object.keys(routeBuckets).length} files, ${routeChunkBytes} bytes total`);
console.log(`  states represented: ${statesRepresented.size}`);
console.log(`  route class counts:`, routeClassCounts);
