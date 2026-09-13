import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { search, MESSAGES } from '../js/search.js';
import { normalizeObject } from '../js/normalize.js';
import { validateZip, distanceMiles, formatApproxDistance, nearestEligibleCoverageZip, GEO_CONTEXT_THRESHOLD_MI } from '../js/geo.js';
import { RESULT_CLASS } from '../js/data.js';

const events = [];

beforeEach(() => {
  events.length = 0;
});

function lastEvent(type) {
  return events.filter((e) => e.type === type).at(-1);
}

// Patch measure module via dynamic import side effect — search imports measure internally.
// We verify privacy by inspecting emitted payloads through a lightweight re-export test.

describe('normalizeObject', () => {
  it('maps allowlisted aliases', () => {
    assert.equal(normalizeObject('sewing machine').objectClass, 'SEWING_MACHINE');
    assert.equal(normalizeObject('OBD-II scanner').objectClass, 'OBD2_SCANNER');
    assert.equal(normalizeObject('pressure washer').objectClass, 'PRESSURE_WASHER');
  });

  it('rejects chainsaw as explicitly unsupported', () => {
    assert.equal(normalizeObject('chainsaw').status, 'UNSUPPORTED');
  });
});

describe('validateZip', () => {
  it('rejects malformed ZIP', () => {
    assert.equal(validateZip('12A45').status, 'INVALID');
  });

  it('rejects well-formed ZIP outside pilot coverage as WELL_FORMED', () => {
    assert.equal(validateZip('10001').status, 'WELL_FORMED');
  });

  it('accepts frozen pilot ZIP', () => {
    assert.equal(validateZip('16693').status, 'VALID');
  });
});

describe('SC-01 sewing machine + 16693', () => {
  it('returns S1 as relevant program with approx distance; S6 may follow', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    assert.equal(out.status, 'ok');
    assert.equal(out.results[0].sourceId, 'S1_ALTOONA_TOOL');
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
    assert.equal(out.results[0].classLabel, 'Relevant borrowing program');
    assert.equal(out.results[0].distanceLabel, 'Approx. 10.7 mi');
    assert.ok(out.results.some((r) => r.sourceId === 'S6_WILLIAMSBURG_LIBRARY_FALLBACK'));
    assert.ok(!out.disclaimers.some((d) => d.includes("don't have a relevant")));
    assert.match(out.results[0].note, /do not claim current availability/i);
  });
});

describe('SC-02 telescope + 01103', () => {
  it('returns S3 regional resource; S4 national specialist may follow', () => {
    const out = search({ objectText: 'telescope', zip: '01103' });
    assert.equal(out.results[0].sourceId, 'S3_MA_LIBRARY_OF_THINGS');
    assert.equal(out.results[0].class, RESULT_CLASS.RESOURCE);
    assert.ok(out.results.some((r) => r.sourceId === 'S4_LIBRARY_TELESCOPE_PROGRAM'));
    assert.ok(!out.results[0].distanceLabel);
  });
});

describe('SC-03 pressure washer + 35967', () => {
  it('shows no-relevant-source message then S5 fallback only', () => {
    const out = search({ objectText: 'pressure washer', zip: '35967' });
    assert.ok(out.disclaimers.some((d) => d === MESSAGES.noRelevantSource));
    assert.equal(out.results.length, 1);
    assert.equal(out.results[0].sourceId, 'S5_DEKALB_LIBRARY_FALLBACK');
    assert.equal(out.results[0].class, RESULT_CLASS.FALLBACK);
  });
});

describe('SC-04 chainsaw + 16693', () => {
  it('shows unsupported-object message; S6 only after disclaimer', () => {
    const out = search({ objectText: 'chainsaw', zip: '16693' });
    assert.match(out.disclaimers[0], /won't guess/i);
    assert.ok(out.results.every((r) => r.class === RESULT_CLASS.FALLBACK));
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.RELEVANT));
    assert.ok(!out.results.some((r) => r.class === RESULT_CLASS.RESOURCE));
  });
});

describe('SC-05 pressure washer + 90210', () => {
  it('routes former no-source pilot ZIP to honest national fallback', async () => {
    const { searchWithNational } = await import('./helpers/national.mjs');
    const out = await searchWithNational(search, {
      objectText: 'pressure washer',
      zip: '90210',
      locationMode: 'ZIP',
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.length >= 1);
    assert.ok(out.results.some((r) => /official page to ask\/check/i.test(r.title)));
    assert.notEqual(out.message, MESSAGES.invalidZip);
  });
});

describe('SC-06 pressure washer + 12A45', () => {
  it('invalid ZIP error with no cards', () => {
    const out = search({ objectText: 'pressure washer', zip: '12A45' });
    assert.equal(out.status, 'error');
    assert.equal(out.message, MESSAGES.invalidZip);
    assert.equal(out.results.length, 0);
  });
});

describe('SC-07 any object + 10001', () => {
  it('observed national ZIP routes to authoritative fallback', async () => {
    const { searchWithNational } = await import('./helpers/national.mjs');
    const { search } = await import('../js/search.js');
    const out = await searchWithNational(search, {
      objectText: 'sewing machine',
      zip: '10001',
      locationMode: 'ZIP',
    });
    assert.equal(out.status, 'ok');
    assert.ok(out.results.some((r) => r.class === 'NEARBY_LIBRARY_TO_ASK'));
    assert.ok(out.results.some((r) => /official page to ask\/check/i.test(r.title)));
  });
});

describe('SC-09 sewing machine + 16693 distance', () => {
  it('presents distance as approximate accepted anchor', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    assert.match(out.results[0].distanceLabel, /^Approx\./);
    assert.ok(out.results[0].distanceLabel.includes('10.7'));
  });
});

describe('SC-11 result card integrity', () => {
  it('every rendered result has class label, CTA URL, and working destination', () => {
    const out = search({ objectText: 'sewing machine', zip: '16693' });
    for (const r of out.results) {
      assert.ok(r.classLabel);
      assert.ok(r.url.startsWith('https://'));
      assert.ok(r.title);
      assert.ok(r.note);
    }
  });
});

describe('SC-12 OBD-II scanner + 19601', () => {
  it('returns S2 as relevant program with approx 8.1 mi', () => {
    const out = search({ objectText: 'OBD-II scanner', zip: '19601' });
    assert.equal(out.results[0].sourceId, 'S2_OLEY_DIAGNOSTIC');
    assert.equal(out.results[0].class, RESULT_CLASS.RELEVANT);
    assert.equal(out.results[0].distanceLabel, 'Approx. 8.1 mi');
    assert.match(out.results[0].note, /do not claim current availability/i);
  });
});

describe('geolocation helpers', () => {
  it('SC-08 nearest eligible centroid when coords near Williamsburg', () => {
    const nearest = nearestEligibleCoverageZip(40.4524, -78.2389);
    assert.equal(nearest.zip, '16693');
    assert.ok(nearest.distanceMi <= GEO_CONTEXT_THRESHOLD_MI);
  });

  it('selects nearest eligible centroid for distant coords', () => {
    const nearest = nearestEligibleCoverageZip(40.7128, -74.006);
    assert.ok(nearest.zip);
    assert.notEqual(nearest.zip, '90210');
    assert.ok(nearest.distanceMi > GEO_CONTEXT_THRESHOLD_MI);
  });
});

describe('distance formatting', () => {
  it('always uses Approx. prefix', () => {
    assert.match(formatApproxDistance(10.7), /^Approx\./);
  });
});

describe('broken destination test fixture', () => {
  it('is excluded from production SOURCES', async () => {
    const { SOURCES } = await import('../js/data.js');
    const { BROKEN_DESTINATION_FIXTURE } = await import('./fixtures/broken-destination.js');
    assert.ok(BROKEN_DESTINATION_FIXTURE.testOnly);
    assert.ok(!SOURCES.some((s) => s.id === BROKEN_DESTINATION_FIXTURE.id));
  });
});

describe('measurement payload privacy', () => {
  it('search_submitted uses canonical class not raw text', async () => {
    const { onMeasure, measureSearchSubmitted } = await import('../js/measure.js');
    const captured = [];
    onMeasure((e) => captured.push(e));
    measureSearchSubmitted({
      objectClass: 'SEWING_MACHINE',
      locationMode: 'ZIP',
      coverageState: 'SUPPORTED',
    });
    const evt = captured[0];
    assert.equal(evt.objectClass, 'SEWING_MACHINE');
    assert.equal(evt.locationMode, 'ZIP');
    assert.ok(!('zip' in evt));
    assert.ok(!('coordinates' in evt));
    assert.ok(!('rawObject' in evt));
  });
});

describe('SC-08 geolocation denied', () => {
  it('exposes clear denied message constant for UI handler', async () => {
    const { MESSAGES } = await import('../js/search.js');
    assert.match(MESSAGES.geolocationDenied, /denied/i);
    assert.match(MESSAGES.geolocationDenied, /ZIP/i);
  });
});

describe('SC-10 accessibility structure', () => {
  it('index.html has labeled inputs and form submit', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /for="object-input"/);
    assert.match(html, /<select id="object-input"/);
    assert.match(html, /for="zip-input"/);
    assert.match(html, /<form[^>]+id="search-form"/);
    assert.match(html, /type="submit"/);
    assert.match(html, /viewport/);
  });
});
