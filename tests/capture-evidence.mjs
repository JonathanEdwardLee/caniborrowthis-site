import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = join(root, 'evidence');

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  const filePath = join(root, path);
  try {
    const body = await readFile(filePath);
    const ext = path.slice(path.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await mkdir(evidenceDir, { recursive: true });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(baseUrl);
await page.screenshot({ path: join(evidenceDir, 'desktop-initial.png'), fullPage: true });

await page.fill('#object-input', 'sewing machine');
await page.fill('#zip-input', '16693');
await page.click('button[type="submit"]');
await page.waitForSelector('.result-card');
await page.screenshot({ path: join(evidenceDir, 'desktop-sc01-results.png'), fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(baseUrl);
await page.fill('#object-input', 'telescope');
await page.fill('#zip-input', '01103');
await page.click('button[type="submit"]');
await page.waitForSelector('.result-card');
await page.screenshot({ path: join(evidenceDir, 'mobile-sc02-results.png'), fullPage: true });

await browser.close();
server.close();
console.log('Screenshots saved to evidence/');
