import { SOURCES, RESULT_CLASS, RESULT_CLASS_LABEL, PILOT_ZIPS } from './data.js?v=pass006';
import { normalizeObject } from './normalize.js?v=pass006';
import { validateZip, formatApproxDistance, GEO_CONTEXT_THRESHOLD_MI } from './geo.js?v=pass006';
import {
  measureSearchSubmitted,
  measureResultsRendered,
} from './measure.js?v=pass006';

const CLASS_RANK = {
  [RESULT_CLASS.RELEVANT]: 1,
  [RESULT_CLASS.RESOURCE]: 2,
  [RESULT_CLASS.FALLBACK]: 4,
};

const MESSAGES = {
  invalidZip: 'Enter a valid 5-digit ZIP.',
  unsupportedZip:
    "We don't cover that ZIP yet. Try Use my location to see the closest area we cover.",
  noRelevantSource:
    "We don't have a relevant borrowing source for this object in this area yet.",
  noNearbyEvidence: 'No approved borrowing source is known for this area yet.',
  unsupportedObject:
    "We don't have a reviewed match for this object yet. We won't guess or broaden it to a related category.",
  unrecognizedObject: "We don't have a reviewed match for this object yet.",
  geolocationDenied:
    'Location access was denied. You can still search by entering a ZIP code.',
  geolocationUnavailable:
    'Location is unavailable. You can still search by entering a ZIP code.',
  noLocalReviewedMatch:
    "We don't have a reviewed local-area match for this object yet. The resource below may help you search more broadly.",
};

function sourceMatchesObject(source, objectClass) {
  if (!source.objectClasses) return false;
  return source.objectClasses.includes(objectClass);
}

function sourceMatchesGeography(source, zip) {
  if (source.national) return true;
  if (!source.geographyZips) return false;
  return source.geographyZips.includes(zip);
}

function fallbackMatchesGeography(source, zip) {
  return source.class === RESULT_CLASS.FALLBACK && source.geographyZips?.includes(zip);
}

function isDistantGeo(locationMode, geoDistanceMi) {
  return (
    locationMode === 'GEO' &&
    geoDistanceMi != null &&
    geoDistanceMi > GEO_CONTEXT_THRESHOLD_MI
  );
}

function applyDistantGeoTrustPolicy(results, disclaimers, locationMode, geoDistanceMi) {
  if (!isDistantGeo(locationMode, geoDistanceMi)) {
    return { results, disclaimers };
  }

  const filteredResults = results
    .filter((r) => r.class !== RESULT_CLASS.FALLBACK)
    .map(({ distanceLabel, ...rest }) => rest);

  const filteredDisclaimers = disclaimers.filter(
    (d) => !d.includes('nearby library below'),
  );

  return { results: filteredResults, disclaimers: filteredDisclaimers };
}

function buildResult(source, zip) {
  const result = {
    sourceId: source.id,
    class: source.class,
    classLabel: RESULT_CLASS_LABEL[source.class],
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

/**
 * Core search logic — pure function for testability.
 * @param {{ objectText: string, zip: string, locationMode?: 'ZIP' | 'GEO', geoDistanceMi?: number, geoTargetKind?: 'national' | 'no_zip' }} input
 */
export function search({ objectText, zip, locationMode = 'ZIP', geoDistanceMi, geoTargetKind }) {
  if (locationMode === 'GEO' && geoTargetKind === 'national') {
    const objectNorm = normalizeObject(objectText);
    if (objectNorm.status !== 'SUPPORTED') {
      return {
        status: 'ok',
        message: MESSAGES.noNearbyEvidence,
        results: [],
        disclaimers: [
          objectNorm.status === 'UNSUPPORTED'
            ? MESSAGES.unsupportedObject
            : MESSAGES.unrecognizedObject,
        ],
        objectClass: null,
      };
    }

    const objectClass = objectNorm.objectClass;
    measureSearchSubmitted({
      objectClass,
      locationMode,
      coverageState: 'SUPPORTED',
    });

    const resources = SOURCES.filter(
      (s) =>
        s.class === RESULT_CLASS.RESOURCE &&
        s.national &&
        sourceMatchesObject(s, objectClass),
    ).map((s) => buildResult(s, null));

    measureResultsRendered({
      relevant: 0,
      resource: resources.length,
      fallback: 0,
      none: resources.length === 0 ? 1 : 0,
    });

    return {
      status: 'ok',
      message: MESSAGES.noLocalReviewedMatch,
      results: resources,
      disclaimers: [],
      objectClass,
    };
  }

  if (locationMode === 'GEO' && geoTargetKind === 'no_zip') {
    const objectNorm = normalizeObject(objectText);

    measureSearchSubmitted({
      objectClass: objectNorm.status === 'SUPPORTED' ? objectNorm.objectClass : 'UNSUPPORTED',
      locationMode,
      coverageState: objectNorm.status === 'SUPPORTED' ? 'SUPPORTED' : 'UNSUPPORTED',
    });

    if (objectNorm.status === 'UNSUPPORTED') {
      measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
      return {
        status: 'ok',
        message: MESSAGES.noNearbyEvidence,
        results: [],
        disclaimers: [MESSAGES.unsupportedObject],
        objectClass: null,
      };
    }

    if (objectNorm.status === 'UNRECOGNIZED') {
      measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
      return {
        status: 'ok',
        message: MESSAGES.noNearbyEvidence,
        results: [],
        disclaimers: [MESSAGES.unrecognizedObject],
        objectClass: null,
      };
    }

    measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
    return {
      status: 'ok',
      message: MESSAGES.noNearbyEvidence,
      results: [],
      disclaimers: [MESSAGES.noRelevantSource],
      objectClass: objectNorm.objectClass,
    };
  }

  const zipResult = validateZip(zip);

  if (zipResult.status === 'INVALID') {
    measureSearchSubmitted({
      objectClass: 'UNSUPPORTED',
      locationMode,
      coverageState: 'UNSUPPORTED',
    });
    return {
      status: 'error',
      message: MESSAGES.invalidZip,
      results: [],
      disclaimers: [],
    };
  }

  if (zipResult.status === 'UNSUPPORTED') {
    measureSearchSubmitted({
      objectClass: 'UNSUPPORTED',
      locationMode,
      coverageState: 'UNSUPPORTED',
    });
    return {
      status: 'error',
      message: MESSAGES.unsupportedZip,
      results: [],
      disclaimers: [],
    };
  }

  const pilotZip = zipResult.zip;
  const zipInfo = PILOT_ZIPS[pilotZip];
  const objectNorm = normalizeObject(objectText);

  if (objectNorm.status === 'UNSUPPORTED') {
    measureSearchSubmitted({
      objectClass: 'UNSUPPORTED',
      locationMode,
      coverageState: 'SUPPORTED',
    });

    const fallbacks = SOURCES
      .filter((s) => fallbackMatchesGeography(s, pilotZip))
      .map((s) => buildResult(s, pilotZip));

    let disclaimers = [MESSAGES.unsupportedObject];
    if (fallbacks.length > 0) {
      disclaimers.push(
        'The nearby library below is a generic place to ask — not a match for this object.',
      );
    }

    let results = fallbacks;
    let message = null;
    ({ results, disclaimers } = applyDistantGeoTrustPolicy(
      results,
      disclaimers,
      locationMode,
      geoDistanceMi,
    ));
    if (results.length === 0 && fallbacks.length > 0) {
      message = MESSAGES.noNearbyEvidence;
    }

    measureResultsRendered({
      relevant: 0,
      resource: 0,
      fallback: results.filter((r) => r.class === RESULT_CLASS.FALLBACK).length,
      none: results.length === 0 ? 1 : 0,
    });

    return {
      status: 'ok',
      message,
      results,
      disclaimers,
      objectClass: null,
    };
  }

  if (objectNorm.status === 'UNRECOGNIZED') {
    measureSearchSubmitted({
      objectClass: 'UNSUPPORTED',
      locationMode,
      coverageState: 'SUPPORTED',
    });

    const fallbacks = SOURCES
      .filter((s) => fallbackMatchesGeography(s, pilotZip))
      .map((s) => buildResult(s, pilotZip));

    const hasRelevantOrResource = false;
    const disclaimers = [];

    if (!hasRelevantOrResource && fallbacks.length > 0 && !zipInfo.noApprovedSource) {
      disclaimers.push(MESSAGES.noRelevantSource);
    }

    if (zipInfo.noApprovedSource) {
      return {
        status: 'ok',
        message: MESSAGES.noNearbyEvidence,
        results: [],
        disclaimers: [MESSAGES.unrecognizedObject],
        objectClass: null,
      };
    }

    if (fallbacks.length === 0 && !hasRelevantOrResource) {
      measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
      return {
        status: 'ok',
        message: MESSAGES.noNearbyEvidence,
        results: [],
        disclaimers: [MESSAGES.unrecognizedObject],
        objectClass: null,
      };
    }

    let results = fallbacks;
    let message = null;
    let finalDisclaimers = [MESSAGES.unrecognizedObject, ...disclaimers];
    ({ results, disclaimers: finalDisclaimers } = applyDistantGeoTrustPolicy(
      results,
      finalDisclaimers,
      locationMode,
      geoDistanceMi,
    ));
    if (results.length === 0 && fallbacks.length > 0) {
      message = MESSAGES.noNearbyEvidence;
    }

    measureResultsRendered({
      relevant: 0,
      resource: 0,
      fallback: results.filter((r) => r.class === RESULT_CLASS.FALLBACK).length,
      none: results.length === 0 ? 1 : 0,
    });

    return {
      status: 'ok',
      message,
      results,
      disclaimers: finalDisclaimers,
      objectClass: null,
    };
  }

  const objectClass = objectNorm.objectClass;
  measureSearchSubmitted({
    objectClass,
    locationMode,
    coverageState: 'SUPPORTED',
  });

  if (zipInfo.noApprovedSource) {
    measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
    return {
      status: 'ok',
      message: MESSAGES.noNearbyEvidence,
      results: [],
      disclaimers: [],
      objectClass,
    };
  }

  const relevant = SOURCES
    .filter(
      (s) =>
        s.class === RESULT_CLASS.RELEVANT &&
        sourceMatchesObject(s, objectClass) &&
        sourceMatchesGeography(s, pilotZip),
    )
    .map((s) => buildResult(s, pilotZip));

  const resources = SOURCES
    .filter((s) => {
      if (s.class !== RESULT_CLASS.RESOURCE) return false;
      if (!sourceMatchesObject(s, objectClass)) return false;
      if (s.national) return true;
      return sourceMatchesGeography(s, pilotZip);
    })
    .map((s) => buildResult(s, pilotZip));

  const fallbacks = SOURCES
    .filter((s) => fallbackMatchesGeography(s, pilotZip))
    .map((s) => buildResult(s, pilotZip));

  const hasRelevantOrResource = relevant.length > 0 || resources.length > 0;
  let disclaimers = [];

  if (!hasRelevantOrResource && fallbacks.length > 0) {
    disclaimers.push(MESSAGES.noRelevantSource);
  }

  if (!hasRelevantOrResource && fallbacks.length === 0) {
    measureResultsRendered({ relevant: 0, resource: 0, fallback: 0, none: 1 });
    return {
      status: 'ok',
      message: MESSAGES.noNearbyEvidence,
      results: [],
      disclaimers: [],
      objectClass,
    };
  }

  let results = [...relevant, ...resources];

  if (!hasRelevantOrResource) {
    results = [...fallbacks];
  } else {
    results = [...results, ...fallbacks];
  }

  const sourceMeta = new Map(SOURCES.map((s) => [s.id, s]));
  results.sort((a, b) => {
    const rankDiff = (CLASS_RANK[a.class] || 99) - (CLASS_RANK[b.class] || 99);
    if (rankDiff !== 0) return rankDiff;
    const aNational = sourceMeta.get(a.sourceId)?.national ? 1 : 0;
    const bNational = sourceMeta.get(b.sourceId)?.national ? 1 : 0;
    return aNational - bNational;
  });

  let message = null;
  const preFilterCount = results.length;
  ({ results, disclaimers } = applyDistantGeoTrustPolicy(
    results,
    disclaimers,
    locationMode,
    geoDistanceMi,
  ));
  if (results.length === 0 && preFilterCount > 0 && !hasRelevantOrResource) {
    message = MESSAGES.noNearbyEvidence;
  }

  measureResultsRendered({
    relevant: results.filter((r) => r.class === RESULT_CLASS.RELEVANT).length,
    resource: results.filter((r) => r.class === RESULT_CLASS.RESOURCE).length,
    fallback: results.filter((r) => r.class === RESULT_CLASS.FALLBACK).length,
    none: results.length === 0 ? 1 : 0,
  });

  return {
    status: 'ok',
    message,
    results,
    disclaimers,
    objectClass,
  };
}

export { MESSAGES };
