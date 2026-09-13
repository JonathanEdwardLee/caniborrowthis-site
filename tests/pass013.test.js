import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { search, MESSAGES } from '../js/search.js';
import { RESULT_CLASS, getAllSources } from '../js/data.js';
import { FORBIDDEN_GA_KEYS } from '../js/measure.js';
import {
  proveMatrixIdentity,
  runPass013Verification,
  writeEvidence,
  MATRIX_SHA256,
  MATRIX_BYTES,
  CENTER_COUNT,
  PROBE_COUNT,
  AVAILABILITY_CLAIM,
} from './helpers/pass013-verify.mjs';
import { preloadNationalData, searchWithNational } from './helpers/national.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let verification;

before(async () => {
  await preloadNationalData();
  verification = await runPass013Verification();
  writeEvidence(verification);
});

describe('P13-01 matrix identity', () => {
  it('matches accepted 151-center packet bytes and SHA-256', () => {
    const matrix = proveMatrixIdentity();
    assert.equal(matrix.bytes, MATRIX_BYTES);
    assert.equal(matrix.sha256, MATRIX_SHA256);
    assert.equal(verification.centers.length, CENTER_COUNT);
  });
});

describe('P13-02 755 ZIP category probes', () => {
  it('runs 151 × 5 = 755 probes with PASS accounting', () => {
    const { report, zipProbes } = verification;
    assert.equal(zipProbes.length, PROBE_COUNT);
    assert.equal(report.zipProbeCount, 755);
    assert.equal(report.zipFail, 0);
    assert.equal(report.failures.filter((f) => !f.startsWith('edge:') && !f.startsWith('GEO|')).length, 0);
  });

  it('treats every representative ZIP as well-formed and returns a source/fallback', () => {
    for (const probe of verification.zipProbes) {
      assert.notEqual(probe.zipStatus, 'INVALID', probe.zip);
      assert.ok(probe.resultCount >= 1, `${probe.place} ${probe.category}`);
      assert.equal(probe.status, 'PASS', JSON.stringify(probe.failures));
    }
  });
});

describe('P13-03 GEO-equivalent 151 centers', () => {
  it('resolves nearest-outlet or honest local/national GEO routing for every center', () => {
    const { geoRows } = verification;
    assert.equal(geoRows.length, CENTER_COUNT);
    assert.equal(verification.report.geoFail, 0);
    for (const row of geoRows) {
      assert.notEqual(row.targetKind, 'no_zip', row.place);
      assert.equal(row.status, 'PASS', JSON.stringify(row.failures));
    }
  });
});

describe('P13-04 required edge regressions', () => {
  it('records PASS for every named edge case', () => {
    const required = [
      'malformed_zip_distinct',
      'unknown_well_formed_zip',
      'former_no_source_90210',
      '72730_conservative',
      'springfield_mo_specialist',
      'mountain_home_ar_specialist',
      'eureka_ar_hold',
      'eureka_springs_distinct',
      'dense_urban_nyc',
      'dense_urban_chicago',
      'state_border_dc',
      'alaska_long_distance',
      'hawaii_island',
      'springfield_mo_geo',
      'sparse_rural_sample',
      'ga_privacy_boundary',
      'zero_unsupported_availability_claims',
    ];
    const byName = Object.fromEntries(verification.report.edges.map((e) => [e.name, e]));
    for (const name of required) {
      assert.equal(byName[name]?.status, 'PASS', `${name}: ${byName[name]?.detail}`);
    }
  });
});

describe('P13-05 privacy, availability, cost, runtime freeze', () => {
  it('keeps GA custom-event payloads free of ZIP/object/coordinates', () => {
    for (const key of FORBIDDEN_GA_KEYS) {
      assert.ok(typeof key === 'string');
    }
    const ga = verification.report.edges.find((e) => e.name === 'ga_privacy_boundary');
    assert.equal(ga.status, 'PASS');
  });

  it('contains no unsupported availability claims in sources or probe corpus', async () => {
    for (const source of getAllSources()) {
      assert.doesNotMatch(`${source.note}\n${source.title}`, AVAILABILITY_CLAIM);
    }
    const out = await searchWithNational(search, {
      objectText: 'telescope',
      zip: '10001',
      locationMode: 'ZIP',
    });
    assert.doesNotMatch(
      [out.message, ...out.results.map((r) => `${r.title} ${r.note}`)].join('\n'),
      AVAILABILITY_CLAIM,
    );
    assert.ok(out.results.every((r) => r.class === RESULT_CLASS.FALLBACK));
  });

  it('does not add runtime dependencies or change national source data', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
    assert.ok(pkg.scripts['verify:pass013']);
    const diff = execFileSync(
      'git',
      ['diff', '--name-only', '40a668c13e4e516e035dbbb47f0ea9213cc540b9', '--', 'js/', 'index.html', '.cibt/pass-012/'],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    assert.equal(diff, '');
  });

  it('keeps malformed ZIP distinct from unknown well-formed ZIP', () => {
    const bad = search({ objectText: 'telescope', zip: '12a45' });
    assert.equal(bad.status, 'error');
    assert.equal(bad.message, MESSAGES.invalidZip);
  });
});
