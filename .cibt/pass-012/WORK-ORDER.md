# CIBT Pass 012 — National Authoritative Routing CloudDev Work Order

## Authority

Owner: CIBT Primary  
Worker role: CloudDev  
Product repository only: `JonathanEdwardLee/caniborrowthis-site`  
Prepared branch: `primary/cibt-pass012-national-routing-20260912`  
Controlling product PR: **#12**  
Base production/regression commit: `2bbfb0af6ade8fe518b45992db6257e5b1d15846`

Accepted Research transfer head:

`77b5ae9c8455557346936b313a73d2af12faa216`

Primary Research acceptance comment: **5649591003**.

CloudDev must not access `pim-control`, `caniborrowthis-research`, OzarksKey, Hostinger, production credentials, payments, or unrelated repositories. All accepted source material required for this mission is local to this prepared product branch.

This is implementation only. Do not refresh sources or conduct a new research pass.

## Startup / PR subscription requirement

Before any implementation mutation, CloudDev must:

1. open controlling product PR **#12**;
2. subscribe to PR #12 using the available GitHub/Cursor PR subscription mechanism;
3. confirm the subscription actually succeeded for the active worker session;
4. read the complete PR conversation and this work order;
5. verify the local transfer packet before implementation;
6. post a top-level startup receipt on PR #12.

The startup receipt must include:
- role: fresh CloudDev session;
- repository: `JonathanEdwardLee/caniborrowthis-site`;
- controlling PR: **#12**;
- exact prepared branch and head observed;
- base production commit;
- this work-order path;
- confirmation that all transfer files and manifests were read;
- reconstruction/hash result for the split ZIP-route file;
- hash verification result for the other deterministic transfer files;
- `PR SUBSCRIPTION: CONFIRMED`;
- actual subscription mechanism/result;
- confirmation that new Primary top-level PR comments are expected to reach this active session without founder relay;
- repository boundary: product repo only;
- first substantive implementation batch;
- next already-authorized implementation batch;
- terminal state `CIBT_PASS_012_READY_FOR_PRIMARY_REVIEW`.

A posted instruction, branch checkout, or PR URL is not dispatch proof.

If CloudDev cannot actually subscribe to PR #12, STOP before implementation and post exactly:

`CIBT_PASS_012_PR_SUBSCRIPTION_UNAVAILABLE`

Do not substitute polling, PR ownership, or comment acknowledgement for subscription.

After a valid receipt, continue the already-authorized bounded mission without waiting for Jonathan. Primary comments on subscribed PR #12 are bounded work orders within this Pass unless they explicitly HOLD the mission.

## Worker branch / review topology

Do not implement directly on the Primary prepared branch.

Create one CloudDev implementation branch from the exact current head of:

`primary/cibt-pass012-national-routing-20260912`

Open one child implementation PR targeting that prepared branch.

Keep PR #12 as the Primary controlling/release queue. Do not merge the child PR yourself. Do not merge PR #12 to `main`. Do not deploy or publish.

## Business objective

Replace the remaining frozen/pilot ZIP limitation with a deterministic, authoritative national public-library fallback spine for all **50 states + DC**, while preserving CIBT as a source finder rather than an inventory service.

Product contract:

`OBJECT + LOCATION -> BEST HONEST BORROWING ANSWER -> OFFICIAL/USEFUL SOURCE`

Pass 011 Ozarks behavior is the production regression baseline and is closed. Do not reopen Ozarks research or broaden specialist claims.

A successful build is product evidence, not customer-demand evidence.

## Immutable local transfer

Directory:

`.cibt/pass-012/transfer/`

Accepted packet identity:

- packet: `CIBT-NATIONAL-TRANSFER-002`;
- accepted Research transfer head: `77b5ae9c8455557346936b313a73d2af12faa216`;
- systems: **9,200**;
- active outlets: **17,415**;
- observed ZIP-reference identifiers: **37,865**;
- Census ZCTAs: **33,791**;
- observed non-ZCTA identifiers retained: **4,074**;
- national verification centers: **151**;
- jurisdictions: **50 states + DC**;
- deterministic payload: **7,990,411 bytes**;
- new recurring cost: **$0**.

Deterministic output SHA-256 values from the accepted manifest:

- `national_centers_151.csv`  
  `7730850bb716803b4186bdd334eb0df12b566326edc3c8b676f751e8c4e18ee7`
- `national_destinations.csv`  
  `0ad7ff3b0869c567f1e70a01551b209a19df81a15899b068202fbeb44c1cba42`
- `national_geo_outlets.csv`  
  `738a7fdd6703a51beb854725076484ba1938d17afc0a95c2441d55eb298c6bfc`
- reconstructed `national_zip_routes.csv`  
  `0ed4e3389a6938a28a8d0b963589488d53884327f207a34e52405bdea466b5f7`

Manifest integrity sidecar expects:

- `national_transfer_manifest.json` bytes: **5862**
- SHA-256: `c0fc6e440ac9073e2fc7d09fd333d20a90b6deb305e03ba127e6314587b42a21`

### ZIP-route reconstruction

The accepted `national_zip_routes.csv` is locally bridged as **11 parts** only because connector transport could not reliably write the 5.05 MB source file in one mutation.

Read:

`.cibt/pass-012/transfer/national_zip_routes.split.json`

Concatenate the parts in lexical filename order with **no inserted or removed bytes**. The reconstructed file must be:

- bytes: **5,048,599**;
- data rows: **37,865**;
- SHA-256: `0ed4e3389a6938a28a8d0b963589488d53884327f207a34e52405bdea466b5f7`.

If reconstruction/hash verification fails, STOP. Do not regenerate or repair Research data.

## Accepted routing classes

Preserve these exact accepted counts:

- `EXACT_IMLS_OUTLET_ZIP`: **15,300**
- `EXACT_IMLS_SYSTEM_ZIP`: **49**
- `ZCTA_NEAREST_ACTIVE_OUTLET`: **18,536**
- `OBSERVED_REFERENCE_INDIRECT_ONLY`: **3,980**

Semantics:

- exact outlet ZIP: active IMLS outlet identity at that ZIP;
- exact system ZIP: active system/admin identity only; do not call it a nearby physical outlet;
- ZCTA-nearest: straight-line routing context from accepted Census ZCTA point to an active outlet; not eligibility, residency, service-area, or inventory proof;
- indirect-only: official IMLS Search & Compare handoff; do not fabricate a nearest local library.

The observed reference universe is **not** a complete/current USPS-validity oracle.

## Product behavior to implement

### 1. Preserve existing product

Preserve:
- all **35** guided object choices;
- Telescope default;
- existing Pass-011 Ozarks specialist and generic-fallback behavior;
- Springfield MO and Mountain Home AR specialist regressions;
- Eureka AR hold / Eureka Springs distinction;
- conservative shared-ZIP `72730` behavior;
- privacy-safe GA4 events;
- Search Console/sitemap/robots/disclosure;
- no false display of an internal routing ZIP as if reverse-geocoded;
- no live/current availability claim.

Existing reviewed object-specific/regional sources outrank generic national fallback.

### 2. Manual ZIP

- malformed ZIP remains invalid;
- an accepted observed 5-digit identifier routes according to its accepted class;
- a well-formed 5-digit ZIP absent from the accepted observed universe is **unknown/unmatched**, not invalid;
- unknown/unmatched well-formed ZIP must still offer official IMLS Search & Compare;
- do not infer state from ZIP prefix;
- do not claim current USPS validity.

### 3. GEO

For permissioned `Use my location`:
- use the accepted active national outlet layer for deterministic nearest-outlet context;
- keep coordinates client-side;
- do not send coordinates to analytics;
- do not reverse-geocode;
- do not expose an internal routing ZIP as if detected;
- nearest outlet is a place/source to check, never proof of item availability or eligibility.

### 4. Ranking

Preserve trust priority:

1. reviewed object-specific borrowing result;
2. reviewed regional/specialist resource;
3. accepted Ozarks/local fallback where applicable;
4. national authoritative public-library fallback;
5. official IMLS Search & Compare indirect path for unknown/indirect-only cases.

A generic national fallback must never suppress a stronger accepted specialist result.

### 5. Data/performance architecture

Implement the smallest maintainable static architecture.

Allowed:
- deterministic build-time/dev-time conversion of accepted local transfer data into static JS/JSON/assets;
- lazy-loading or equivalent practical loading strategy;
- deterministic validation scripts/tests.

Not allowed:
- runtime AI;
- database;
- live crawling;
- paid geocoder;
- USPS paid/current-validity service;
- new API key;
- new server/runtime dependency;
- new recurring cost.

Do not silently edit accepted transfer rows. Preserve provenance and deterministic regeneration/validation for any derived product asset.

The initial page must remain practical; do not force the full national payload into the critical initial page path if a static lazy-loaded design can avoid it.

## Explicit non-goals

Do not:
- research new specialist programs;
- turn CIBT into national exact item inventory;
- scrape library catalogs;
- add accounts;
- add ads, affiliates, subscriptions, checkout or payment code;
- create national SEO page farms;
- change GA to capture object text, ZIP or coordinates;
- mutate Research or `pim-control`;
- access Hostinger/DNS/production credentials;
- deploy/publish;
- self-merge.

The full 151-center verification pass is the **next Pass** after this one. Pass 012 may use a bounded subset for implementation verification but must preserve the full accepted 151-center file for the next gate.

## Required verification

Before terminal return, prove at minimum:

1. transfer manifest/integrity checks pass;
2. reconstructed ZIP-route file matches exact byte count/hash;
3. 9,200 destinations represented;
4. 17,415 active outlets represented;
5. 37,865 observed routing identifiers represented;
6. exact route-class counts match the accepted manifest;
7. all 50 states + DC structurally represented;
8. exact IMLS outlet ZIP case works;
9. exact IMLS system/admin ZIP semantics stay non-physical;
10. ZCTA-nearest-outlet case works;
11. observed-reference indirect-only case works;
12. unknown well-formed 5-digit ZIP -> IMLS Search & Compare, not invalid;
13. malformed ZIP remains invalid;
14. dense urban case works;
15. sparse/rural case works;
16. state-border case works;
17. Alaska long-distance case remains honest;
18. Hawaii/island case remains honest;
19. Springfield MO regression passes;
20. Mountain Home AR regression passes;
21. Eureka AR remains held/distinct from Eureka Springs;
22. conflicting `72730` regression passes;
23. accepted local/specialist results outrank national generic fallback;
24. GEO does not display fabricated/reverse-geocoded ZIP;
25. analytics tests prove no raw object text, ZIP, or coordinates are emitted;
26. forbidden exact-availability language is absent;
27. desktop/mobile/keyboard browser behavior remains sound;
28. initial-load/data-loading behavior is practical and measured;
29. `npm audit` is clean or every finding is surfaced without concealment;
30. new recurring cost remains **$0**.

Do not count worker claims as Primary acceptance.

## Return evidence

On the child implementation PR and controlling PR #12, return:

- exact terminal implementation head;
- child PR number;
- changed files;
- transfer verification commands/results;
- ZIP reconstruction command/result;
- any deterministic asset-generation command;
- generated artifact sizes;
- initial-load/performance evidence;
- complete unit/browser test commands and pass/fail counts;
- `npm audit` result;
- routing-class counts actually loaded;
- 50-state+DC representation evidence;
- explicit examples for each required route class;
- explicit unknown-well-formed and malformed ZIP behavior;
- Springfield/Mountain Home/Eureka/`72730` regression results;
- analytics privacy result;
- screenshot evidence for representative desktop/mobile states, including one national generic fallback and one preserved local specialist result;
- recurring-cost impact;
- known limitations;
- confirmation of no merge to main, deployment, publication, Research mutation, or control access.

## Stop conditions

STOP and report if:
- any accepted transfer hash/count cannot be reproduced;
- the 9,200/17,415 accepted universe must change;
- source refresh/new research becomes necessary;
- a complete current USPS-validity oracle becomes necessary;
- national routing would require fabricated locality/eligibility/availability claims;
- accepted Pass-011 source truth would have to be weakened;
- initial-page/data performance becomes materially impractical without a different architecture;
- credential/API key/new recurring cost is required;
- another repository is required;
- scope expands into inventory, monetization, deployment, publication, or account infrastructure.

## Terminal

When implementation and all worker-side evidence are complete, post exactly:

`CIBT_PASS_012_READY_FOR_PRIMARY_REVIEW`

Do not merge. Do not deploy. Do not publish.
