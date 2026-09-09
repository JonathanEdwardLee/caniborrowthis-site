import { PILOT_ZIPS } from './data.js';

const MILES_PER_KM = 0.621371;
const PILOT_RADIUS_MI = 15;

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

/**
 * Find nearest supported pilot ZIP centroid to given coordinates.
 * @returns {{ status: 'IN_RANGE', zip: string, distanceMi: number } | { status: 'OUT_OF_RANGE', nearestZip: string, distanceMi: number }}
 */
export function nearestPilotZip(lat, lon) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const [zip, info] of Object.entries(PILOT_ZIPS)) {
    const d = distanceMiles(lat, lon, info.lat, info.lon);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = zip;
    }
  }

  if (nearestDist > PILOT_RADIUS_MI) {
    return { status: 'OUT_OF_RANGE', nearestZip: nearest, distanceMi: nearestDist };
  }
  return { status: 'IN_RANGE', zip: nearest, distanceMi: nearestDist };
}

export function getZipCentroid(zip) {
  const info = PILOT_ZIPS[zip];
  if (!info) return null;
  return { lat: info.lat, lon: info.lon, label: info.label };
}
