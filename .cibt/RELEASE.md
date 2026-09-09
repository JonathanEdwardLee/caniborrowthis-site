# CIBT Release — GitHub Pages

Release-only deployment plumbing for the accepted Pass 003 static pilot.

## Deployment

- **Mechanism:** GitHub Actions → GitHub Pages (`actions/deploy-pages`)
- **Trigger:** push to `main` (after release PR merge) or manual `workflow_dispatch`
- **Artifact:** `index.html`, `css/`, `js/`, `.nojekyll` only — runtime site identical to accepted candidate
- **Cost:** $0 recurring (GitHub Pages on public repos)

## Expected public URL

https://jonathanedwardlee.github.io/caniborrowthis-site/

## Repository setting required

**Settings → Pages → Build and deployment → Source:** GitHub Actions

## Rollback

1. Revert or disable `.github/workflows/pages.yml` on `main`
2. In **Settings → Pages**, optionally unpublish or switch source
3. Previous deployment remains in GitHub Pages deployment history for restore via re-run

## Tests (unchanged product)

```bash
npm install
npm test
```
