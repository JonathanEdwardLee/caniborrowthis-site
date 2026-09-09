/** Privacy-safe local/no-op measurement hooks — no analytics dependency. */
const listeners = [];

export function onMeasure(callback) {
  listeners.push(callback);
}

function emit(event) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      /* no-op */
    }
  }
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
