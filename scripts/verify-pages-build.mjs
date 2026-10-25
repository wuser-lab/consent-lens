import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const base = '/consent-lens/';
const html = await readFile('dist/index.html', 'utf8');
assert.ok(!html.includes('%BASE_URL%'), 'Unresolved HTML base placeholder');
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert.ok(assets.some(value => value.startsWith(`${base}assets/`)), 'Missing project-relative assets');
assert.ok(assets.includes(base), 'Brand link must remain within the deployed project');
assert.ok(assets.includes(`${base}examples/synthetic-review.json`), 'Sample link must include the project base');
for (const value of assets) {
  if (/^(https?:|#)/.test(value)) continue;
  assert.ok(value.startsWith(base), `URL escapes project base: ${value}`);
  if (value !== base) await access(join('dist', value.slice(base.length)));
}
JSON.parse(await readFile('dist/examples/synthetic-review.json', 'utf8'));
console.log('GitHub Pages build: assets, home link, and sample report resolve under /consent-lens/.');
