# CIBT Pass 013 verification results

## Identity

- Child HEAD (this evidence commit will update HEAD): recorded in git
- Exact base / product main: `34517eb51c0ae30ba5874135542e8c9eb622f398`
- Prepared Primary head: `40a668c13e4e516e035dbbb47f0ea9213cc540b9`
- Matrix: `.cibt/pass-012/transfer/national_centers_151.csv`
- Matrix bytes: 74,992
- Matrix SHA-256: `7730850bb716803b4186bdd334eb0df12b566326edc3c8b676f751e8c4e18ee7`

## Accounting

- ZIP category probes: **755/755 PASS** (151 × 5)
- GEO-equivalent centers: **151/151 PASS** (product GEO resolved + nearest-outlet `GEO_NEAREST_ACTIVE_OUTLET` with permissioned-location note)
- Named edge cases: **17/17 PASS**
- Combined verifier PASS/FAIL/HOLD: **923 / 0 / 0**
- Exact failure list: *(empty)*
- Unsupported availability claims: **0**
- GA privacy boundary: **PASS** (payload keys: `object_class`, `location_mode`, `coverage_state` only)

## Named edges

| Case | Result |
| --- | --- |
| Dense urban (NYC, Chicago) | PASS |
| Sparse/rural (15 tagged centers) | PASS |
| State border (DC) | PASS |
| Alaska long-distance | PASS |
| Hawaii/island | PASS |
| Springfield, MO specialist + GEO | PASS |
| Mountain Home, AR specialist | PASS |
| Eureka, AR hold distinct from Eureka Springs | PASS |
| 72730 conservative (no Fayetteville fab lab) | PASS |
| Former no-source 90210 national fallback | PASS |
| Malformed ZIP ≠ unknown well-formed ZIP | PASS |

## Suites and audit

- Unit (`npm run test:unit`): **178 pass / 0 fail**
- Browser (`npm run test:browser`): **26 pass / 0 fail**
- Combined `npm test`: **204 pass / 0 fail**
- `npm audit`: **0 vulnerabilities**

## Freeze

- Runtime / source-data files under `js/`, `index.html`, and `.cibt/pass-012/` vs prepared head: **unchanged**
- Recurring-cost delta: **$0**
- Founder touches after startup: **0**
- PR #14 subscription: **CONFIRMED** (`sub_3ce06f29-be47-44ec-ac9b-27f3b33aab03`)
- NO MERGE / NO DEPLOY

`CIBT_PASS_013_755_VERIFICATION_READY_FOR_PRIMARY_REVIEW`
