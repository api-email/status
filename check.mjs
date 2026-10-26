// Runs every check once and appends one JSON line to data/<UTC date>.ndjson.
import { appendFileSync, mkdirSync } from 'node:fs';
import { MONITORS } from './lib/monitors.mjs';
import { withRetry } from './lib/checks.mjs';

const t = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const entries = await Promise.all(MONITORS.map(async (m) => [m.id, await withRetry(m.check)]));
const results = Object.fromEntries(entries);

mkdirSync('data', { recursive: true });
appendFileSync(`data/${t.slice(0, 10)}.ndjson`, `${JSON.stringify({ t, results })}\n`);
for (const [id, r] of entries) console.log(`${id.padEnd(8)} ${r.ok ? 'up  ' : 'DOWN'} ${String(r.ms).padStart(6)} ms ${r.code ?? r.error ?? ''}${r.retried ? ' (retried)' : ''}`);
