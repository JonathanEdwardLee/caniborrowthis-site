# CIBT Pass 011 — Ozarks Deep Coverage CloudDev Work Order

## Authority

Owner: CIBT Primary  
Worker role: CloudDev  
Product repository only: `JonathanEdwardLee/caniborrowthis-site`  
Prepared branch: `primary/cibt-pass011-ozarks-coverage-20260912`  
Base production commit: `15772544ed03d0ec4252725250e5bd0263bb4982`

This branch contains the minimum immutable/public-safe transfer from accepted CIBT Research head:

`fe0abe8e0ea6e2a93bf60d2e712b4450a50c4dd8`

Research acceptance comment: `5649061758`.

CloudDev must not access `pim-control`, `caniborrowthis-research`, OzarksKey, Hostinger, production credentials, payments, or unrelated repositories. All source material required for this mission is local to this branch.

## Startup / PR subscription requirement

Before any implementation mutation, CloudDev must:

1. open the controlling product PR for this branch;
2. subscribe to that PR using the available GitHub/Cursor PR subscription mechanism;
3. confirm the subscription actually succeeded for the active worker session;
4. read the complete PR conversation and this work order;
5. post a top-level startup receipt on the PR.

The startup receipt must include:
- role: fresh CloudDev session;
- repository;
- controlling PR number;
- exact branch and head observed;
- base production commit;
- this work-order path;
- confirmation that the two transfer files and manifest were read;
- SHA-256 verification result for both transfer files;
- `PR SUBSCRIPTION: CONFIRMED`;
- actual subscription mechanism/result;
- confirmation that new Primary top-level PR comments are expected to reach this session without founder relay;
- repository boundary: product repo only;
- first substantive implementation batch;
- next already-authorized implementation batch;
- terminal state `CIBT_PASS_011_READY_FOR_PRIMARY_REVIEW`.

A posted instruction or PR URL is not dispatch proof.

If CloudDev cannot actually subscribe to the PR, STOP before implementation and post:

`CIBT_PASS_011_PR_SUBSCRIPTION_UNAVAILABLE`

Do not substitute branch polling, PR ownership, or comment acknowledgement for subscription.

After a valid receipt, continue the already-authorized work without waiting for Jonathan. Primary review comments on the subscribed PR are bounded work orders within this pass unless they explicitly HOLD the mission.

## Business objective

Move CIBT materially toward passive completion by making the accepted Ozarks region useful across the current OzarksKey city footprint without turning CIBT into an exact-inventory service.

This is **Ozarks deep coverage**, not national rollout.

The product remains a source finder:

`OBJECT + LOCATION -> BEST HONEST BORROWING ANSWER -> OFFICIAL/USEFUL SOURCE`

A passed build is not demand evidence.

## Immutable transfer inputs

Under `.cibt/pass-011/`:

- `TRANSFER-MANIFEST.json`
- `ozarks_city_filters.csv`
- `ozarks_key_city_category_probes_85.csv`

At startup, verify SHA-256 exactly:

- `ozarks_city_filters.csv` = `0939f690565efcb09837738159d5864e6ed6918465a4f2eb5962f4e463f6d2c0`
- `ozarks_key_city_category_probes_85.csv` = `615189bf001b8b3a97a7f4451a52aa3343bfb2123845d047b5a312be971c4493`

If either hash differs, STOP and report transfer corruption. Do not regenerate research data.

## Baseline to preserve

Pass 010 production behavior at `15772544ed03d0ec4252725250e5bd0263bb4982` is the regression baseline:

- guided selector with 35 reviewed object choices;
- Telescope default;
- manual ZIP and Use my location;
- Springfield MO accepted sources;
- Mountain Home AR accepted sources;
- existing national telescope-resource behavior;
- privacy-safe GA4 measurement;
- Search Console/sitemap/robots;
- no raw object text, ZIP, or coordinates in analytics;
- no false detected-ZIP display;
- no current-availability promise;
- zero new recurring cost.

Do not remove working non-Ozarks Pass-010 examples merely to simplify the new data model.

## Scope

Implement the smallest maintainable data/routing change that makes the accepted Ozarks transfer useful.

### 1. Ozarks city routing layer

Consume all 76 transferred city rows.

- Exactly 75 rows have `product_route_eligible=true`.
- `Eureka, AR` is the sole `REVIEW_HOLD` and must remain non-route-eligible.
- Do not merge Eureka AR into Eureka Springs.
- Do not infer a ZIP, coordinates, outlet, or destination for Eureka AR.
- Do not expose the research HOLD as an ordinary user route.

For each route-eligible city, preserve:
- city/state identity;
- representative ZIP/context;
- internal point for GEO comparison;
- nearest reviewed IMLS fallback identity;
- destination URL/class/handoff;
- distance/ranking basis;
- specialist state.

### 2. Manual ZIP behavior

Add the 75 route-eligible representative ZIPs as accepted Ozarks routing inputs.

Rules:
- valid transferred representative ZIP -> route to the associated accepted city/source context;
- existing Pass-010 ZIP behavior outside this packet remains working;
- a 5-digit ZIP not in accepted product coverage must not be called invalid merely because it is unsupported;
- format-invalid input remains an error;
- unsupported-but-well-formed ZIP gets an honest unsupported/indirect message, not an invented nearby result.

Do not claim national ZIP completeness in Pass 011.

### 3. Geolocation behavior inside the Ozarks packet

For `Use my location`:
- compare client-side coordinates only against route-eligible transferred city/internal points;
- choose the nearest accepted Ozarks route when it is the best reviewed local path;
- preserve existing object-aware specialist behavior where Pass 010 already has stronger evidence;
- never route through Eureka AR;
- do not reverse-geocode or add a paid geocoder;
- do not send coordinates to analytics.

Do not introduce a misleading hard claim that the chosen city is the user's actual city. It is a reviewed routing context.

### 4. Generic fallback semantics

A generic fallback means:

**official library/resource destination to ask/check; no selected-object relevance or current availability asserted.**

When no reviewed specialist result exists for the chosen object/city:
- show the accepted generic fallback from the transferred city row;
- classify it as the existing fallback result class;
- clearly say it is a place to ask/check, not proof the object is carried;
- linked source remains final authority.

Do not convert state-library homepage handoffs into claims about a specific library's holdings.

### 5. Key-city specialist probe use

The 85-row probe file covers 17 key cities × 5 research category families.

Treat statuses conservatively:

- `ACCEPTED_CANDIDATE`: may support a reviewed object/category-specific source or resource when the transferred evidence actually matches the selected object family.
- `FALLBACK`: generic fallback only.
- `CANDIDATE`: do **not** auto-promote to a relevant borrowing claim. At most use as a generic/resource path when implementation can do so without asserting object-specific lending; otherwise fall back.
- `HOLD`: never publish as a specialist claim in this pass.

Existing Pass-010 accepted Springfield/Mountain Home specialist sources remain authoritative and must not be downgraded by a weaker probe row.

Do not broaden one category-family probe into exact claims for every object in that family. Example: evidence for "DIY Tools" does not prove a pressure washer is offered.

### 6. Result ranking

Preserve the trust hierarchy:

1. reviewed object-specific borrowing result;
2. reviewed regional/specialist resource;
3. accepted generic nearby-library/source handoff;
4. honest no-reviewed-match state.

Never rank a generic fallback above an accepted object-specific source.

### 7. Data architecture

You may refactor the current hard-coded pilot routing into a small static data module/adapter if needed.

Constraints:
- plain static site remains acceptable;
- no database;
- no runtime AI;
- no live crawling;
- no paid geocoder;
- no new server/runtime dependency;
- no new recurring cost;
- no national 9,200-system import in this pass.

The transferred CSVs may be converted at build/dev time into deterministic static JS/JSON if useful, but preserve provenance and provide a deterministic regeneration/validation path. Do not silently edit source transfer rows.

## Explicit non-goals

Do not:
- implement national 9,200-system routing yet;
- implement exact item inventories;
- scrape live library catalogs;
- add accounts;
- add ads, affiliates, subscriptions, checkout, or payment code;
- change analytics to capture search text, ZIP, or coordinates;
- change DNS/Hostinger/deployment;
- mutate research/control repositories;
- publish or deploy;
- self-merge.

## Required tests

Add deterministic/unit/browser coverage proving at minimum:

1. transferred SHA-256 values match the manifest;
2. 76 transferred rows exist;
3. exactly 75 are product-route-eligible;
4. Eureka AR is REVIEW_HOLD and cannot produce a route;
5. Springfield MO and Mountain Home AR regressions still pass;
6. representative ZIPs for Lampe, Point Lookout, Ridgedale, and Locust Grove route to their accepted fallback contexts;
7. Eureka Springs AR remains distinct and works independently;
8. manual unsupported 5-digit ZIP is distinguished from malformed ZIP;
9. GEO routing does not expose a fabricated detected ZIP;
10. generic fallback copy never claims selected-object relevance or current availability;
11. HOLD probe rows cannot become specialist results;
12. weaker CANDIDATE rows cannot be promoted to "relevant borrowing program" automatically;
13. accepted specialist results outrank generic fallback;
14. Pass-010 non-Ozarks regressions remain working;
15. analytics payload tests still prove no raw object text, ZIP, or coordinates;
16. browser/mobile/keyboard behavior remains sound;
17. forbidden phrases such as `available now`, `in stock`, or equivalent exact-availability claims are absent from public copy/results;
18. `npm audit` remains clean or any new finding is surfaced rather than hidden.

## Acceptance evidence

Return on the controlling PR:

- exact terminal head;
- changed files;
- transfer hash verification;
- data-generation command if conversion is used;
- complete unit/browser test commands and counts;
- `npm audit` result;
- route-eligible city count;
- HOLD count;
- ZIP input count added;
- specialist-result count actually published by status/category;
- fallback count;
- explicit Eureka AR behavior;
- Springfield/Mountain Home regression results;
- screenshot evidence for:
  - one Springfield specialist search;
  - one Mountain Home specialist search;
  - Lampe or Ridgedale generic fallback;
  - Eureka Springs route;
  - unsupported well-formed ZIP;
  - mobile layout;
- recurring-cost impact;
- known limitations;
- confirmation of no deployment/publication.

## Stop conditions

STOP and report if:
- transfer hashes do not match;
- Eureka AR cannot be kept safely non-routeable;
- implementing representative-ZIP routing would require a paid/current USPS service;
- existing Pass-010 source truth would have to be weakened;
- tests expose systemic source/routing ambiguity;
- a credential/API key or new recurring cost is required;
- the task expands into national inventory, monetization, deployment, or another repository.

## Terminal

When implementation and evidence are complete, post exactly:

`CIBT_PASS_011_READY_FOR_PRIMARY_REVIEW`

Do not merge. Do not deploy. Do not publish.