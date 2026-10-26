// Renders public/index.html and public/status.json from the last 90 days of data/.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MONITORS } from './lib/monitors.mjs';
import { addDays, buildModel, parseHistory } from './lib/summary.mjs';
import { renderPage } from './lib/render.mjs';

const DAYS = 90;
const now = new Date();
const today = now.toISOString().slice(0, 10);
let text = '';
for (let i = DAYS - 1; i >= 0; i--) {
  const file = `data/${addDays(today, -i)}.ndjson`;
  if (existsSync(file)) text += `${readFileSync(file, 'utf8')}\n`;
}
const model = buildModel(parseHistory(text), MONITORS, { now, days: DAYS });

mkdirSync('public', { recursive: true });
writeFileSync('public/index.html', renderPage(model));
writeFileSync('public/status.json', `${JSON.stringify(model, null, 2)}\n`);
copyFileSync('favicon.svg', 'public/favicon.svg');
console.log(`built public/ from ${model.since ?? 'no checks'} to ${model.lastCheck ?? '-'}`);
