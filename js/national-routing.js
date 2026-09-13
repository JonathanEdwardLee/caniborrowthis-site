/**
 * Lazy-loaded national authoritative routing from accepted Pass 012 transfer assets.
 */
import {
  IMLS_SEARCH_COMPARE_URL,
  NATIONAL_REVIEW_DATE,
  ROUTE_CLASS,
} from './national/constants.js?v=pass012';
import { RESULT_CLASS } from './data.js?v=pass012';

const KM_TO_MI = 0.621371;

function formatApproxDistance(miles) {
  return `Approx. ${miles.toFixed(1)} mi`;
}

let destinationsPromise = null;
let outletsPromise = null;
const routePrefixPromises = new Map();
let destinationsCache = null;
let outletsCache = null;
const routePrefixCache = new Map();

const NOTES = {
  EXACT_IMLS_OUTLET_ZIP:
    'Active IMLS outlet identity at this observed official ZIP identifier; not current USPS validity or live inventory proof. Check the linked source.',
  EXACT_IMLS_SYSTEM_ZIP:
    'Active IMLS system/admin identity at this observed official ZIP identifier; not a physical nearby outlet; not current USPS validity or live inventory proof.',
  ZCTA_NEAREST_ACTIVE_OUTLET:
    'Straight-line nearest active IMLS outlet context from accepted Census ZCTA data; not eligibility, residency, service-area, or inventory proof.',
  OBSERVED_REFERENCE_INDIRECT_ONLY:
    'Observed official reference with no safe exact or coordinate route; use IMLS Search & Compare. This is not a rejection.',
  UNKNOWN_ZIP:
    'This well-formed ZIP is outside our accepted observed reference universe; use IMLS Search & Compare to find libraries. We do not infer state from ZIP prefix or claim current USPS validity.',
};

function outletKey(fscskey, fscsSeq) {
  return `${fscskey}|${fscsSeq}`;
}

function resolveAssetPath(relativePath) {
  return new URL(relativePath, import.meta.url);
}

async function loadJson(relativePath) {
  const path = resolveAssetPath(relativePath);
  if (typeof process !== 'undefined' && process.versions?.node && path.protocol === 'file:') {
    const { readFileSync } = await import('node:fs');
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function ensureDestinationsLoaded() {
  if (destinationsCache) return destinationsCache;
  if (!destinationsPromise) {
    destinationsPromise = loadJson('./national/destinations.json').then((data) => {
      destinationsCache = data;
      return data;
    });
  }
  return destinationsPromise;
}

async function ensureOutletsLoaded() {
  if (outletsCache) return outletsCache;
  if (!outletsPromise) {
    outletsPromise = loadJson('./national/outlets.json').then((data) => {
      outletsCache = data;
      return data;
    });
  }
  return outletsPromise;
}

async function ensureRoutePrefixLoaded(prefix) {
  if (routePrefixCache.has(prefix)) return routePrefixCache.get(prefix);
  if (!routePrefixPromises.has(prefix)) {
    routePrefixPromises.set(
      prefix,
      loadJson(`./national/routes/${prefix}.json`).then((data) => {
        routePrefixCache.set(prefix, data);
        return data;
      }).catch(() => null),
    );
  }
  return routePrefixPromises.get(prefix);
}

/** Preload all national assets — used in tests and optional warm-up. */
export async function ensureNationalDataLoaded() {
  await Promise.all([ensureDestinationsLoaded(), ensureOutletsLoaded()]);
  const prefixes = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
  await Promise.all(prefixes.map((prefix) => ensureRoutePrefixLoaded(prefix).catch(() => null)));
}

export async function lookupZipRoute(zip) {
  const prefix = zip.slice(0, 2);
  const bucket = await ensureRoutePrefixLoaded(prefix);
  if (!bucket || !bucket[zip]) return null;
  const row = bucket[zip];
  return {
    zip,
    routeClass: ROUTE_CLASS[row.c],
    fscskey: row.k,
    fscsSeq: row.s,
    distanceKm: row.d ?? null,
  };
}

export function buildImlsSearchCompareSource(sourceId = 'NAT_IMLS_SEARCH_COMPARE') {
  return {
    id: sourceId,
    class: RESULT_CLASS.FALLBACK,
    url: IMLS_SEARCH_COMPARE_URL,
    title: 'IMLS Search & Compare — official library finder',
    geographyZips: null,
    objectClasses: null,
    objectRelevance: 'NONE_ASSERTED',
    note: NOTES.OBSERVED_REFERENCE_INDIRECT_ONLY,
    reviewDate: NATIONAL_REVIEW_DATE,
    nationalFallback: true,
    routeClass: 'OBSERVED_REFERENCE_INDIRECT_ONLY',
    linkOnly: true,
  };
}

function titleCaseWords(value) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function buildOutletTitle(outlet, destination, routeClass) {
  if (routeClass === 'EXACT_IMLS_SYSTEM_ZIP') {
    return `${titleCaseWords(destination.libname)} — official system/admin page to ask/check`;
  }
  return `${titleCaseWords(outlet?.libname || destination.libname)} — official page to ask/check`;
}

export async function buildNationalFallbackSource(route) {
  if (!route) return null;
  if (route.routeClass === 'OBSERVED_REFERENCE_INDIRECT_ONLY') {
    return {
      ...buildImlsSearchCompareSource(`NAT_IMLS_${route.zip}`),
      geographyZips: [route.zip],
    };
  }

  const destinations = await ensureDestinationsLoaded();
  const destination = destinations[route.fscskey];
  if (!destination) return null;

  let outlet = null;
  if (route.fscsSeq) {
    const outlets = await ensureOutletsLoaded();
    outlet = outlets[outletKey(route.fscskey, route.fscsSeq)] || null;
  }

  const source = {
    id: `NAT_${route.routeClass}_${route.zip}_${route.fscskey}_${route.fscsSeq || 'SYS'}`,
    class: RESULT_CLASS.FALLBACK,
    url: destination.url,
    title: buildOutletTitle(outlet, destination, route.routeClass),
    geographyZips: [route.zip],
    objectClasses: null,
    objectRelevance: 'NONE_ASSERTED',
    note: NOTES[route.routeClass],
    reviewDate: destination.reviewDate || NATIONAL_REVIEW_DATE,
    nationalFallback: true,
    routeClass: route.routeClass,
    linkOnly: destination.handoff === 'indirect',
    destinationClass: destination.destinationClass,
  };

  if (route.routeClass === 'ZCTA_NEAREST_ACTIVE_OUTLET' && route.distanceKm != null) {
    source.acceptedDistanceMi = {
      [route.zip]: route.distanceKm * KM_TO_MI,
    };
  }

  return source;
}

export async function resolveNationalZipContext(zip) {
  const route = await lookupZipRoute(zip);
  if (route) {
    return { kind: 'observed', zip, route };
  }
  return { kind: 'unknown', zip };
}

export async function findNearestNationalOutlet(lat, lon) {
  const outlets = await ensureOutletsLoaded();
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  let nearest = null;

  for (const outlet of Object.values(outlets)) {
    if (!Number.isFinite(outlet.lat) || !Number.isFinite(outlet.lon)) continue;
    const dLat = toRad(outlet.lat - lat);
    const dLon = toRad(outlet.lon - lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(outlet.lat)) * Math.sin(dLon / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { outlet, distanceKm };
    }
  }

  return nearest;
}

export async function resolveNationalGeoTarget(lat, lon) {
  const nearest = await findNearestNationalOutlet(lat, lon);
  if (!nearest) return { kind: 'no_outlet' };

  const { outlet, distanceKm } = nearest;
  const route = {
    zip: outlet.zip,
    routeClass: 'ZCTA_NEAREST_ACTIVE_OUTLET',
    fscskey: outlet.fscskey,
    fscsSeq: outlet.fscsSeq,
    distanceKm,
  };

  return {
    kind: 'national_outlet',
    zip: outlet.zip,
    distanceMi: distanceKm * KM_TO_MI,
    label: `${titleCaseWords(outlet.city)}, ${outlet.state}`,
    route,
  };
}

export function nationalSourceToResult(source, zip) {
  const result = {
    sourceId: source.id,
    class: source.class,
    classLabel: 'Nearby library to ask',
    title: source.title,
    url: source.url,
    note: source.note,
    reviewDate: source.reviewDate,
    linkOnly: Boolean(source.linkOnly),
    objectRelevance: source.objectRelevance || null,
  };
  if (source.acceptedDistanceMi?.[zip] != null) {
    result.distanceLabel = formatApproxDistance(source.acceptedDistanceMi[zip]);
  }
  return result;
}

export { NOTES as NATIONAL_NOTES, IMLS_SEARCH_COMPARE_URL };

/** Test-only reset for deterministic unit tests. */
export function __resetNationalCachesForTests() {
  destinationsPromise = null;
  outletsPromise = null;
  routePrefixPromises.clear();
  destinationsCache = null;
  outletsCache = null;
  routePrefixCache.clear();
}
