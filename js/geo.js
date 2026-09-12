import { getAllSources, RESULT_CLASS, PILOT_ZIPS } from './data.js?v=pass011';
import { normalizeObject } from './normalize.js?v=pass011';
import { OZARKS_CITIES } from './ozarks-generated.js?v=pass011';

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
  if (
    source.class === RESULT_CLASS.RESOURCE &&
    (source.geographyZips?.length || source.geographyCityKeys?.length)
  ) {
    return true;
  }
  return false;
}

function findNearestObjectRelevantZip(lat, lon, objectClass) {
  const candidates = [];

  for (const source of getAllSources()) {
    if (!isGeographyBoundObjectRelevantSource(source, objectClass)) continue;
    for (const routeCityKey of source.geographyCityKeys || []) {
      const city = OZARKS_CITIES.find((row) => row.key === routeCityKey);
      if (!city?.productRouteEligible || city.lat == null || city.lon == null) continue;
      const distanceMi = distanceMiles(lat, lon, city.lat, city.lon);
      candidates.push({
        zip: city.representativeZip,
        cityKey: city.key,
        distanceMi,
        label: `${city.city}, ${city.state}`,
        sourceId: source.id,
      });
    }
    for (const zip of source.geographyZips || []) {
      const info = PILOT_ZIPS[zip];
      if (!info || info.noApprovedSource || info.lat == null || info.lon == null) continue;
      const distanceMi = distanceMiles(lat, lon, info.lat, info.lon);
      candidates.push({
        zip,
        cityKey: info.ozarksCityKey || null,
        distanceMi,
        label: info.label,
        sourceId: source.id,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distanceMi - b.distanceMi);
  return candidates[0];
}

function considerFallbackCandidate(nearest, lat, lon, zip, pointLat, pointLon, label, cityKey) {
  if (pointLat == null || pointLon == null || !zip) return nearest;
  const info = PILOT_ZIPS[zip];
  if (!info || info.noApprovedSource) return nearest;
  const distanceMi = distanceMiles(lat, lon, pointLat, pointLon);
  if (distanceMi <= GEO_CONTEXT_THRESHOLD_MI && (!nearest || distanceMi < nearest.distanceMi)) {
    return { zip, distanceMi, label, cityKey: cityKey || null };
  }
  return nearest;
}

function findNearestFallbackWithinThreshold(lat, lon) {
  let nearest = null;

  for (const source of getAllSources()) {
    if (source.class !== RESULT_CLASS.FALLBACK) continue;
    for (const zip of source.geographyZips || []) {
      const info = PILOT_ZIPS[zip];
      if (!info || info.lat == null || info.lon == null) continue;
      nearest = considerFallbackCandidate(
        nearest,
        lat,
        lon,
        zip,
        info.lat,
        info.lon,
        info.label,
        info.ozarksCityKey || null,
      );
    }
  }

  for (const city of OZARKS_CITIES) {
    if (!city.productRouteEligible) continue;
    nearest = considerFallbackCandidate(
      nearest,
      lat,
      lon,
      city.representativeZip,
      city.lat,
      city.lon,
      `${city.city}, ${city.state}`,
      city.key,
    );
  }

  return nearest;
}

export function getOzarksCity(city, state) {
  return OZARKS_CITIES.find((row) => row.city === city && row.state === state) || null;
}

function hasNationalResourceForObject(objectClass) {
  return getAllSources().some(
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
    if (info.lat == null || info.lon == null) continue;
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
  return `Showing the closest reviewed source area for this search: ${label} (${formatApproxDistance(distanceMi)} away).`;
}

export function getZipCentroid(zip) {
  const info = PILOT_ZIPS[zip];
  if (!info) return null;
  return { lat: info.lat, lon: info.lon, label: info.label };
}

export { isEligibleGeoDestination };
