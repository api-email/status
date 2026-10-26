import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../lib/render.mjs';
import { buildModel, parseHistory } from '../lib/summary.mjs';

const MONITORS = [
  { id: 'website', name: 'Website', target: 'https://api.email' },
  { id: 'api', name: 'API', target: 'https://api.email/v1' },
];
const line = (t, results) => JSON.stringify({ t, results });
const up = { ok: true, ms: 100, code: 200 };
const now = new Date('2026-10-26T22:00:00Z');

const page = (lines) => renderPage(buildModel(parseHistory(lines.join('\n')), MONITORS, { now, days: 90 }));

test('all checks up: says so, names the start of monitoring and shows no fabricated history', () => {
  const html = page([line('2026-10-26T21:50:00Z', { website: up, api: up })]);
  assert.match(html, /All systems operational/);
  assert.match(html, /Monitoring since 26 October 2026/);
  assert.match(html, /No outages detected since monitoring began/);
  // 89 days before monitoring began are drawn as "no data", one day with data.
  assert.equal((html.match(/class="d nodata"/g) ?? []).length, 2 * 89);
  assert.equal((html.match(/class="d up"/g) ?? []).length, 2);
});

test('a monitor whose latest check failed is shown as down, with the outage listed', () => {
  const html = page([
    line('2026-10-26T21:45:00Z', { website: up, api: up }),
    line('2026-10-26T21:50:00Z', { website: up, api: { ok: false, ms: 10000, code: 503 } }),
  ]);
  assert.match(html, /Some systems are down/);
  assert.match(html, /API<\/b>[\s\S]*?Down/);
  assert.match(html, /ongoing/);
  assert.match(html, /HTTP 503/);
});

test('a day with failed checks is partial and shows its uptime', () => {
  const html = page([
    line('2026-10-26T21:40:00Z', { website: up, api: up }),
    line('2026-10-26T21:45:00Z', { website: up, api: { ok: false, ms: 10000, error: 'timeout' } }),
    line('2026-10-26T21:50:00Z', { website: up, api: up }),
  ]);
  assert.match(html, /class="d partial" title="26 Oct 2026: 66\.67% \(2 of 3 checks\)"/);
});

test('error text from a check is escaped', () => {
  const html = page([line('2026-10-26T21:50:00Z', { website: up, api: { ok: false, ms: 1, error: '<script>x</script>' } })]);
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('no checks yet: the page says so instead of claiming anything', () => {
  const html = page([]);
  assert.match(html, /No checks yet/);
  assert.doesNotMatch(html, /operational/i);
});
