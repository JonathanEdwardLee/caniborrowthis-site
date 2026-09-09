import { search, MESSAGES } from './search.js';
import { nearestEligibleCoverageZip, formatGeoCoverageContext } from './geo.js';
import {
  measureOutboundClicked,
  measureLocationPermissionResult,
} from './measure.js';

const form = document.getElementById('search-form');
const objectInput = document.getElementById('object-input');
const zipInput = document.getElementById('zip-input');
const locateBtn = document.getElementById('locate-btn');
const statusEl = document.getElementById('status-message');
const disclaimersEl = document.getElementById('disclaimers');
const resultsEl = document.getElementById('results');

let activeZip = '';
let locationMode = 'ZIP';
let pendingGeoContext = null;

function clearUI() {
  statusEl.textContent = '';
  statusEl.hidden = true;
  disclaimersEl.innerHTML = '';
  disclaimersEl.hidden = true;
  resultsEl.innerHTML = '';
}

function showStatus(message, variant = 'info') {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.dataset.variant = variant;
}

function renderDisclaimers(disclaimers) {
  if (!disclaimers?.length) {
    disclaimersEl.hidden = true;
    return;
  }
  disclaimersEl.hidden = false;
  disclaimersEl.innerHTML = disclaimers
    .map((d) => `<p class="disclaimer">${escapeHtml(d)}</p>`)
    .join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderResults(results) {
  resultsEl.innerHTML = '';
  for (const result of results) {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.dataset.class = result.class;
    card.dataset.sourceId = result.sourceId;

    const distanceHtml = result.distanceLabel
      ? `<p class="result-distance">${escapeHtml(result.distanceLabel)}</p>`
      : '';

    card.innerHTML = `
      <p class="result-class-label">${escapeHtml(result.classLabel)}</p>
      <h3 class="result-title">${escapeHtml(result.title)}</h3>
      ${distanceHtml}
      <p class="result-note">${escapeHtml(result.note)}</p>
      <p class="result-review">Reviewed ${escapeHtml(result.reviewDate)}</p>
      <a class="result-cta" href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">
        Check this source
      </a>
    `;

    const cta = card.querySelector('.result-cta');
    cta.addEventListener('click', () => {
      measureOutboundClicked({
        sourceId: result.sourceId,
        resultClass: result.class,
      });
    });

    resultsEl.appendChild(card);
  }
}

function runSearch() {
  clearUI();
  const zip = activeZip || zipInput.value.trim();
  const outcome = search({
    objectText: objectInput.value,
    zip,
    locationMode,
  });

  if (pendingGeoContext) {
    showStatus(pendingGeoContext, 'info');
    pendingGeoContext = null;
  }

  if (outcome.status === 'error') {
    showStatus(outcome.message, 'error');
    return;
  }

  if (outcome.message && statusEl.hidden) {
    showStatus(outcome.message, 'info');
  } else if (outcome.message) {
    showStatus(`${statusEl.textContent} ${outcome.message}`, 'info');
  }

  renderDisclaimers(outcome.disclaimers);
  renderResults(outcome.results);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  locationMode = 'ZIP';
  activeZip = zipInput.value.trim();
  pendingGeoContext = null;
  runSearch();
});

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    measureLocationPermissionResult({ result: 'ERROR' });
    showStatus(MESSAGES.geolocationUnavailable, 'error');
    return;
  }

  locateBtn.disabled = true;
  locateBtn.setAttribute('aria-busy', 'true');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      measureLocationPermissionResult({ result: 'GRANTED' });
      const { latitude, longitude } = pos.coords;
      const nearest = nearestEligibleCoverageZip(latitude, longitude);
      locateBtn.disabled = false;
      locateBtn.removeAttribute('aria-busy');

      locationMode = 'GEO';
      activeZip = nearest.zip;
      zipInput.value = nearest.zip;
      pendingGeoContext = formatGeoCoverageContext(nearest.label, nearest.distanceMi);
      runSearch();
    },
    (err) => {
      const result = err.code === err.PERMISSION_DENIED ? 'DENIED' : 'ERROR';
      measureLocationPermissionResult({ result });
      locateBtn.disabled = false;
      locateBtn.removeAttribute('aria-busy');
      showStatus(
        result === 'DENIED' ? MESSAGES.geolocationDenied : MESSAGES.geolocationUnavailable,
        'error',
      );
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
  );
});
