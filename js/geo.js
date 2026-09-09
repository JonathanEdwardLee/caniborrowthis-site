import { SOURCES, RESULT_CLASS, PILOT_ZIPS } from './data.js?v=pass006';
import { normalizeObject } from './normalize.js?v=pass006';

const MILES_PER_KM = 0.621371;
/** Show geo coverage context when user is farther than this from the centroid (straight-line). */
export const GEO_CONTEXT_THRESHOLD_MI = 15;

/** Haversine distance in miles between two lat/lon points. */
export function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * MILES_PER_KM;
}

export function formatApproxDistance(miles) {
  return `Approx. ${miles.toFixed(1)} mi`;
}

/**
 * @param {string} zip
 * @returns {{ status: 'VALID', zip: string } | { status: 'INVALID' } | { status: 'UNSUPPORTED' }}
 */
export function validateZip(zip) {
  const trimmed = (zip || '').trim();
  if (!/^\d{5}$/.test(trimmed)) {
    return { status: 'INVALID' };
  }
  if (!PILOT_ZIPS[trimmed]) {
    return { status: 'UNSUPPORTED' };
  }
  return { status: 'VALID', zip: trimmed };
}

function isEligibleGeoDestination(zip) {
  const info = PILOT_ZIPS[zip];
  return Boolean(info && !info.noApprovedSource);
}

function sourceMatchesObject(source, objectClass) {
  if (!source.objectClasses) return false;
  return source.objectClasses.includes(objectClass);
}

function isGeographyBoundObjectRelevantSource(source, objectClass) {
  if (source.class === RESULT_CLASS.FALLBACK) return false;
  if (source.national) return false;
  if (!sourceMatchesObject(source, objectClass)) return false;
  if (source.class === RESULT_CLASS.RELEVANT) return true;
  if (source.class === RESULT_CLASS.RESOURCE && source.geographyZips?.length) return true;
  return false;
}

function findNearestObjectRelevantZip(lat, lon, objectClass) {
  const candidates = [];

  for (const source of SOURCES) {
    if (!isGeographyBoundObjectRelevantSource(source, objectClass)) continue;
    for (const zip of source.geographyZips) {
      const info = PILOT_ZIPS[zip];
      if (!info || info.noApprovedSource) continue;
      const distanceMi = distanceMiles(lat, lon, info.lat, info.lon);
      candidates.push({ zip, distanceMi, label: info.label, sourceId: source.id });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distanceMi - b.distanceMi);
  return candidates[0];
}

function findNearestFallbackWithinThreshold(lat, lon) {
  let nearest = null;

  for (const source of SOURCES) {
    if (source.class !== RESULT_CLASS.FALLBACK) continue;
    for (const zip of source.geographyZips || []) {
      const info = PILOT_ZIPS[zip];
      if (!info || info.noApprovedSource) continue;
      const distanceMi = distanceMiles(lat, lon, info.lat, info.lon);
      if (distanceMi <= GEO_CONTEXT_THRESHOLD_MI && (!nearest || distanceMi < nearest.distanceMi)) {
        nearest = { zip, distanceMi, label: info.label };
      }
    }
  }

  return nearest;
}

function hasNationalResourceForObject(objectClass) {
  return SOURCES.some(
    (s) =>
      s.class === RESULT_CLASS.RESOURCE &&
      s.national &&
      sourceMatchesObject(s, objectClass),
  );
}

/**
 * Nearest supported ZIP centroid with approved source/fallback coverage.
 * Excludes noApprovedSource areas (e.g. 90210). No distance cutoff.
 * Retained for regression tests; GEO click handler uses resolveGeoSearchTarget.
 */
export function nearestEligibleCoverageZip(lat, lon) {
  let nearestZip = null;
  let nearestDist = Infinity;

  for (const [zip, info] of Object.entries(PILOT_ZIPS)) {
    if (info.noApprovedSource) continue;
    const d = distanceMiles(lat, lon, info.lat, info.lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearestZip = zip;
    }
  }

  return {
    zip: nearestZip,
    distanceMi: nearestDist,
    label: PILOT_ZIPS[nearestZip]?.label ?? '',
  };
}

/**
 * Object-aware GEO routing: normalize/classify object before choosing destination.
 * @returns {{ kind: 'zip', zip: string, distanceMi: number, label: string, objectNorm: object }
 *         | { kind: 'national', objectClass: string, objectNorm: object }
 *         | { kind: 'no_zip', objectNorm: object }}
 */
export function resolveGeoSearchTarget(lat, lon, objectText) {
  const objectNorm = normalizeObject(objectText);

  if (objectNorm.status === 'SUPPORTED') {
    const nearestRelevant = findNearestObjectRelevantZip(lat, lon, objectNorm.objectClass);
    if (nearestRelevant) {
      return { kind: 'zip', ...nearestRelevant, objectNorm };
    }
    if (hasNationalResourceForObject(objectNorm.objectClass)) {
      return { kind: 'national', objectClass: objectNorm.objectClass, objectNorm };
    }
    const nearFallback = findNearestFallbackWithinThreshold(lat, lon);
    if (nearFallback) {
      return { kind: 'zip', ...nearFallback, objectNorm };
    }
    return { kind: 'no_zip', objectNorm };
  }

  const nearFallback = findNearestFallbackWithinThreshold(lat, lon);
  if (nearFallback) {
    return { kind: 'zip', ...nearFallback, objectNorm };
  }
  return { kind: 'no_zip', objectNorm };
}

export function formatGeoCoverageContext(label, distanceMi) {
  if (distanceMi <= GEO_CONTEXT_THRESHOLD_MI) return null;
  return `Showing the closest area we currently cover: ${label} (${formatApproxDistance(distanceMi)} away).`;
}

export function getZipCentroid(zip) {
  const info = PILOT_ZIPS[zip];
  if (!info) return null;
  return { lat: info.lat, lon: info.lon, label: info.label };
}

export { isEligibleGeoDestination };
