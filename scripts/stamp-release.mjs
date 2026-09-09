import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();

const releasePath = join(root, 'js', 'release.js');
let releaseJs = await readFile(releasePath, 'utf8');
releaseJs = releaseJs.replace(/commit: '[^']*'/, `commit: '${commit}'`);
await writeFile(releasePath, releaseJs);

const indexPath = join(root, 'index.html');
let indexHtml = await readFile(indexPath, 'utf8');
indexHtml = indexHtml.replace(
  /(<meta name="cibt-release-commit" content=")[^"]*(")/,
  `$1${commit}$2`,
);
indexHtml = indexHtml.replace(
  /(id="cibt-release-marker"[^>]*data-commit=")[^"]*(")/,
  `$1${commit}$2`,
);
await writeFile(indexPath, indexHtml);

console.log(`Stamped release commit: ${commit}`);
