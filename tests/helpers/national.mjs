import {
  ensureNationalDataLoaded,
  resolveNationalZipContext,
  buildNationalFallbackSource,
} from '../../js/national-routing.js';

let preloadPromise = null;

export async function preloadNationalData() {
  if (!preloadPromise) {
    preloadPromise = ensureNationalDataLoaded();
  }
  return preloadPromise;
}

export async function nationalSearchContext(zip) {
  if (!/^\d{5}$/.test(zip)) {
    return { nationalZipContext: null, nationalRoute: null };
  }
  const nationalZipContext = await resolveNationalZipContext(zip);
  if (nationalZipContext.kind === 'observed') {
    nationalZipContext.source = await buildNationalFallbackSource(nationalZipContext.route);
  }
  return {
    nationalZipContext,
    nationalRoute: nationalZipContext.route || null,
  };
}

export async function searchWithNational(searchFn, params) {
  const zip = params.zip || '';
  const ctx = await nationalSearchContext(zip);
  return searchFn({ ...params, ...ctx });
}
