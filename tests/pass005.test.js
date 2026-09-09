import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CIBT_RELEASE } from '../js/release.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(root, 'js');

const RETIRED_PATTERNS = [
  { pattern: /nearestPilotZip/, label: 'nearestPilotZip' },
  { pattern: /outsidePilot/, label: 'outsidePilot' },
  { pattern: /OUT_OF_RANGE/, label: 'OUT_OF_RANGE' },
  { pattern: /outside.*limit/i, label: 'outside-limit message' },
];

async function readRepoTextFiles() {
  const files = ['index.html', '.htaccess'];
  const jsEntries = await readdir(JS_DIR);
  for (const name of jsEntries) {
    if (name.endsWith('.js')) files.push(join('js', name));
  }
  const contents = new Map();
  for (const rel of files) {
    contents.set(rel, await readFile(join(root, rel), 'utf8'));
  }
  return contents;
}

describe('P5-01 no retired outside-limit geo dead end', () => {
  it('repository scan finds no nearestPilotZip, OUT_OF_RANGE, or outsidePilot paths', async () => {
    const files = await readRepoTextFiles();
    for (const [file, content] of files) {
      for (const { pattern, label } of RETIRED_PATTERNS) {
        assert.doesNotMatch(content, pattern, `${file} must not contain retired ${label}`);
      }
    }
  });
});

describe('P5-02 versioned static asset references', () => {
  it('index.html requests pass005-versioned CSS and entry JS', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /href="css\/styles\.css\?v=pass005"/);
    assert.match(html, /src="js\/app\.js\?v=pass005"/);
  });

  it('module graph imports use pass005 version query', async () => {
    const appJs = await readFile(join(root, 'js', 'app.js'), 'utf8');
    const searchJs = await readFile(join(root, 'js', 'search.js'), 'utf8');
    assert.match(appJs, /from '\.\/search\.js\?v=pass005'/);
    assert.match(searchJs, /from '\.\/geo\.js\?v=pass005'/);
  });
});

describe('P5-03 machine-readable release marker', () => {
  it('index.html exposes pass005 release meta and hidden DOM marker', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /<meta name="cibt-release" content="pass005">/);
    assert.match(html, /<meta name="cibt-release-commit" content="[0-9a-f]+">/);
    assert.match(html, /id="cibt-release-marker"[^>]*data-release="pass005"/);
    assert.match(html, /data-commit="[0-9a-f]+"/);
  });

  it('release.js exports pass005 identity', () => {
    assert.equal(CIBT_RELEASE.pass, 'pass005');
    assert.equal(CIBT_RELEASE.version, 'pass005');
    assert.match(CIBT_RELEASE.commit, /^[0-9a-f]+$/);
  });
});

describe('P5-04 Hostinger-compatible cache policy', () => {
  it('.htaccess sets HTML no-cache and JS/CSS must-revalidate', async () => {
    const htaccess = await readFile(join(root, '.htaccess'), 'utf8');
    assert.match(htaccess, /html/i);
    assert.match(htaccess, /no-cache/i);
    assert.match(htaccess, /must-revalidate/i);
    assert.match(htaccess, /\(js\|css\)/);
  });
});
