/** Privacy-safe measurement hooks bridged to coarse GA4 events when gtag is present. */
const listeners = [];

const FORBIDDEN_GA_KEYS = [
  'zip',
  'rawObject',
  'objectText',
  'coordinates',
  'latitude',
  'longitude',
  'query',
  'searchText',
];

export function onMeasure(callback) {
  listeners.push(callback);
}

export function bridgeEventToGa4(event, gtag = globalThis.gtag) {
  if (typeof gtag !== 'function' || !event?.type) return;

  switch (event.type) {
    case 'search_submitted':
      gtag('event', 'search_submitted', {
        object_class: event.objectClass || 'UNSUPPORTED',
        location_mode: event.locationMode,
        coverage_state: event.coverageState,
      });
      break;
    case 'results_rendered':
      gtag('event', 'results_rendered', {
        relevant_count: event.counts.RELEVANT,
        resource_count: event.counts.RESOURCE,
        fallback_count: event.counts.FALLBACK,
        none_count: event.counts.NONE,
      });
      break;
    case 'outbound_clicked':
      gtag('event', 'outbound_clicked', {
        source_id: event.sourceId,
        result_class: event.resultClass,
      });
      break;
    case 'location_permission_result':
      gtag('event', 'location_permission_result', {
        result: event.result,
      });
      break;
    default:
      break;
  }
}

function emit(event) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      /* no-op */
    }
  }
  bridgeEventToGa4(event);
}

export function measureSearchSubmitted({ objectClass, locationMode, coverageState }) {
  emit({
    type: 'search_submitted',
    objectClass: objectClass || 'UNSUPPORTED',
    locationMode,
    coverageState,
  });
}

export function measureResultsRendered({ relevant, resource, fallback, none }) {
  emit({
    type: 'results_rendered',
    counts: {
      RELEVANT: relevant,
      RESOURCE: resource,
      FALLBACK: fallback,
      NONE: none,
    },
  });
}

export function measureOutboundClicked({ sourceId, resultClass }) {
  emit({
    type: 'outbound_clicked',
    sourceId,
    resultClass,
  });
}

export function measureLocationPermissionResult({ result }) {
  emit({
    type: 'location_permission_result',
    result,
  });
}

export { FORBIDDEN_GA_KEYS };
