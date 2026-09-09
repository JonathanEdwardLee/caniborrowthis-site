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
  it('index.html requests pass006-versioned CSS and entry JS', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /href="css\/styles\.css\?v=pass006"/);
    assert.match(html, /src="js\/app\.js\?v=pass006"/);
  });

  it('every relative runtime .js import uses pass006 version query', async () => {
    const importPattern = /from\s+['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g;
    const jsEntries = await readdir(JS_DIR);

    for (const name of jsEntries.filter((entry) => entry.endsWith('.js'))) {
      const relPath = join('js', name);
      const content = await readFile(join(root, relPath), 'utf8');
      for (const [, specifier] of content.matchAll(importPattern)) {
        assert.match(
          specifier,
          /\.js\?v=pass006$/,
          `${relPath} import "${specifier}" must use ?v=pass006`,
        );
      }
    }
  });
});

describe('P5-03 machine-readable release marker', () => {
  it('index.html exposes pass006 release meta and hidden DOM marker', async () => {
    const html = await readFile(join(root, 'index.html'), 'utf8');
    assert.match(html, /<meta name="cibt-release" content="pass006">/);
    assert.doesNotMatch(html, /cibt-release-commit/);
    assert.match(html, /id="cibt-release-marker"[^>]*data-release="pass006"/);
    assert.doesNotMatch(html, /data-commit=/);
  });

  it('release.js exports pass006 identity without commit stamp', () => {
    assert.equal(CIBT_RELEASE.pass, 'pass006');
    assert.equal(CIBT_RELEASE.version, 'pass006');
    assert.equal(CIBT_RELEASE.commit, undefined);
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
