import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { search, MESSAGES } from '../js/search.js';
import {
  nearestEligibleCoverageZip,
  formatGeoCoverageContext,
  GEO_CONTEXT_THRESHOLD_MI,
} from '../js/geo.js';
import { RESULT_CLASS } from '../js/data.js';

const FORBIDDEN_PUBLIC = /\bpilot\b|prototype|pass\s*003|not deployed/i;

describe('P4-01 no public pilot/prototype language', () => {
  it('index.html has no forbidden visitor-facing terms', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(html, FORBIDDEN_PUBLIC);
    assert.match(html, /Find places to check for borrowing/);
    assert.match(html, /We link you to libraries and borrowing resources/);
  });

  it('MESSAGES contain no pilot/prototype language', () => {
    for (const msg of Object.values(MESSAGES)) {
      assert.doesNotMatch(msg, FORBIDDEN_PUBLIC);
    }
  });
});

describe('P4-02 intro examples are source-backed only', () => {
  it('lists supported examples and excludes pressure washer', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const ideas = html.match(/id="search-ideas"[^>]*>([^<]+)/)?.[1] ?? '';
    for (const term of [
      'sewing machine',
      'telescope',
      'OBD-II scanner',
      'binoculars',
      'electricity usage meter',
      'mobile hotspot',
      'science kit',
      'guitar',
    ]) {
      assert.match(ideas, new RegExp(term, 'i'));
    }
    assert.doesNotMatch(ideas, /pressure washer/i);
  });
});

describe('P4-03 geo beyond old 15-mile radius', () => {
  it('selects nearest eligible area for NYC coords without OUT_OF_RANGE', () => {
    const nearest = nearestEligibleCoverageZip(40.7128, -74.006);
    assert.ok(nearest.zip);
    assert.notEqual(nearest.zip, '90210');
    assert.ok(nearest.distanceMi > GEO_CONTEXT_THRESHOLD_MI);
    const out = search({ objectText: 'OBD-II scanner', zip: nearest.zip, locationMode: 'GEO' });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.length > 0);
    const context = formatGeoCoverageContext(nearest.label, nearest.distanceMi);
    assert.match(context, /closest area we currently cover/);
    assert.match(context, /Approx\./);
  });
});

describe('P4-04 geo near 90210 skips no-source ZIP', () => {
  it('chooses nearest eligible source-backed area, not 90210', () => {
    const nearest = nearestEligibleCoverageZip(34.1031, -118.4163);
    assert.notEqual(nearest.zip, '90210');
    assert.ok(['16693', '19601', '35967', '01103'].includes(nearest.zip));
  });
});

describe('P4-05 denied geolocation message', () => {
  it('keeps ZIP path available in denied copy', () => {
    assert.match(MESSAGES.geolocationDenied, /denied/i);
    assert.match(MESSAGES.geolocationDenied, /ZIP/i);
  });
});

describe('P4-06 ZIP fail-closed public copy', () => {
  it('invalid ZIP uses public error', () => {
    const out = search({ objectText: 'sewing machine', zip: '12A45' });
    assert.equal(out.status, 'error');
    assert.equal(out.message, MESSAGES.invalidZip);
  });

  it('unsupported ZIP uses public copy without pilot language', () => {
    const out = search({ objectText: 'sewing machine', zip: '10001' });
    assert.equal(out.status, 'error');
    assert.equal(out.message, MESSAGES.unsupportedZip);
    assert.match(out.message, /Use my location/);
  });
});

describe('P4-07 regression: ranking and fail-closed behavior', () => {
  it('SC-01 relevant program still ranks first', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    assert.equal(out.results[0].sourceId, 'S1_ALTOONA_TOOL');
  });

  it('chainsaw remains unsupported without category expansion', () => {
    const out = search({ objectText: 'chainsaw', zip: '16693' });
    assert.match(out.disclaimers[0], /won't guess/i);
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
  });

  it('90210 manual ZIP still has no invented fallback', () => {
    const out = search({ objectText: 'pressure washer', zip: '90210' });
    assert.equal(out.results.length, 0);
    assert.equal(out.message, MESSAGES.noNearbyEvidence);
  });
});

describe('P4-08 privacy measurement payloads', () => {
  it('search_submitted omits raw query fields', async () => {
    const { onMeasure, measureSearchSubmitted } = await import('../js/measure.js');
    const captured = [];
    onMeasure((e) => captured.push(e));
    measureSearchSubmitted({
      objectClass: 'TELESCOPE',
      locationMode: 'GEO',
      coverageState: 'SUPPORTED',
    });
    const evt = captured[0];
    assert.ok(!('zip' in evt));
    assert.ok(!('coordinates' in evt));
    assert.ok(!('rawObject' in evt));
  });
});

describe('P4-09 accessibility structure', () => {
  it('index.html retains labeled inputs and viewport', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /for="object-input"/);
    assert.match(html, /for="zip-input"/);
    assert.match(html, /viewport/);
  });
});

describe('P4-10 public copy strings', () => {
  it('uses area-based messaging', () => {
    assert.match(MESSAGES.noRelevantSource, /this area yet/);
    assert.match(MESSAGES.noNearbyEvidence, /this area yet/);
    assert.match(MESSAGES.unrecognizedObject, /reviewed match/);
  });
});

describe('P4-11 distant GEO trust: no misleading nearby fallbacks or distances', () => {
  const distantMi = GEO_CONTEXT_THRESHOLD_MI + 50;

  it('far GEO + generic-only outcome does not render Nearby library to ask', () => {
    const out = search({
      objectText: 'pressure washer',
      zip: '16693',
      locationMode: 'GEO',
      geoDistanceMi: distantMi,
    });
    assert.equal(out.status, 'ok');
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
    assert.ok(!out.results.some((r) => r.classLabel === 'Nearby library to ask'));
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.noRelevantSource));
  });

  it('far GEO + relevant result suppresses ZIP-reference distance labels', () => {
    const out = search({
      objectText: 'OBD-II scanner',
      zip: '19601',
      locationMode: 'GEO',
      geoDistanceMi: distantMi,
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    assert.ok(out.results.every((r) => !r.distanceLabel));
  });

  it('near GEO retains fallback cards and distance labels', () => {
    const out = search({
      objectText: 'sewing machine',
      zip: '16693',
      locationMode: 'GEO',
      geoDistanceMi: 5,
    });
    assert.equal(out.status, 'ok');
    assert.equal(out.results[0].distanceLabel, 'Approx. 10.7 mi');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
  });

  it('manual ZIP retains fallback cards and distance labels', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693', locationMode: 'ZIP' });
    assert.equal(out.status, 'ok');
    assert.equal(out.results[0].distanceLabel, 'Approx. 10.7 mi');
    assert.ok(out.results.some((r) => r.class === RESULT_CLASS.FALLBACK));
  });
});
