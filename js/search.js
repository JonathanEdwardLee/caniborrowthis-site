import { SOURCES, RESULT_CLASS, RESULT_CLASS_LABEL, PILOT_ZIPS } from './data.js';
import { normalizeObject } from './normalize.js';
import { validateZip, formatApproxDistance } from './geo.js';
import {
  measureSearchSubmitted,
  measureResultsRendered,
} from './measure.js';

const CLASS_RANK = {
  [RESULT_CLASS.RELEVANT]: 1,
  [RESULT_CLASS.RESOURCE]: 2,
  [RESULT_CLASS.FALLBACK]: 4,
};

const MESSAGES = {
  invalidZip: 'Enter a valid 5-digit ZIP.',
  unsupportedZip: "This pilot does not cover that ZIP yet.",
  outsidePilot: "Location is outside this pilot's supported areas",
  noRelevantSource:
    "We don't have a relevant borrowing source for this object in this pilot area yet.",
  noNearbyEvidence:
    'No approved nearby borrowing source is known for this pilot area.',
  unsupportedObject:
    'This object is not supported in the pilot. We cannot suggest category matches or broaden to related items.',
  unrecognizedObject:
    'We do not have a reviewed match for this object in the pilot.',
  geolocationDenied:
    'Location access was denied. You can still search by entering a ZIP code.',
  geolocationUnavailable:
    'Location is unavailable. You can still search by entering a ZIP code.',
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
 * @param {{ objectText: string, zip: string, locationMode?: 'ZIP' | 'GEO' }} input
 */
export function search({ objectText, zip, locationMode = 'ZIP' }) {
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

    const disclaimers = [MESSAGES.unsupportedObject];
    if (fallbacks.length > 0) {
      disclaimers.push(
        'The nearby library below is a generic place to ask — not a match for this object.',
      );
    }

    const results = fallbacks;
    measureResultsRendered({
      relevant: 0,
      resource: 0,
      fallback: results.length,
      none: results.length === 0 ? 1 : 0,
    });

    return {
      status: 'ok',
      message: null,
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

    measureResultsRendered({
      relevant: 0,
      resource: 0,
      fallback: fallbacks.length,
      none: 0,
    });

    return {
      status: 'ok',
      message: null,
      results: fallbacks,
      disclaimers: [MESSAGES.unrecognizedObject, ...disclaimers],
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
  const disclaimers = [];

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

  measureResultsRendered({
    relevant: relevant.length,
    resource: resources.length,
    fallback: hasRelevantOrResource ? fallbacks.length : results.filter((r) => r.class === RESULT_CLASS.FALLBACK).length,
    none: results.length === 0 ? 1 : 0,
  });

  return {
    status: 'ok',
    message: null,
    results,
    disclaimers,
    objectClass,
  };
}

export { MESSAGES };
