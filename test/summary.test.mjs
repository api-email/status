import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistory, dailyStats, uptimePercent, outages, latest, buildModel } from '../lib/summary.mjs';

const line = (t, results) => JSON.stringify({ t, results });
const up = { ok: true, ms: 100, code: 200 };
const down = { ok: false, ms: 10000, error: 'timeout' };

test('parseHistory skips blank and broken lines and sorts by time', () => {
  const text = [line('2026-10-26T10:05:00Z', { api: up }), '', '{broken', line('2026-10-26T10:00:00Z', { api: down })].join('\n');
  const records = parseHistory(text);
  assert.deepEqual(records.map((r) => r.t), ['2026-10-26T10:00:00Z', '2026-10-26T10:05:00Z']);
});

test('dailyStats covers every day of the window, oldest first, with zero checks before monitoring began', () => {
  const records = parseHistory(
    [line('2026-10-25T23:55:00Z', { api: up }), line('2026-10-26T00:05:00Z', { api: down }), line('2026-10-26T00:10:00Z', { api: up })].join('\n'),
  );
  const stats = dailyStats(records, 'api', { days: 3, today: '2026-10-26' });
  assert.deepEqual(stats, [
    { date: '2026-10-24', up: 0, total: 0 },
    { date: '2026-10-25', up: 1, total: 1 },
    { date: '2026-10-26', up: 1, total: 2 },
  ]);
});

test('a monitor missing from a check does not count for that day', () => {
  const records = parseHistory(line('2026-10-26T00:05:00Z', { website: up }));
  assert.deepEqual(dailyStats(records, 'api', { days: 1, today: '2026-10-26' }), [{ date: '2026-10-26', up: 0, total: 0 }]);
});

test('uptimePercent is the share of successful checks, or null without data', () => {
  assert.equal(uptimePercent([{ up: 3, total: 4 }, { up: 0, total: 0 }]), 75);
  assert.equal(uptimePercent([{ up: 0, total: 0 }]), null);
});

test('outages group consecutive failed checks and end at the next successful one, newest first', () => {
  const records = parseHistory(
    [
      line('2026-10-26T10:00:00Z', { api: up }),
      line('2026-10-26T10:05:00Z', { api: down }),
      line('2026-10-26T10:10:00Z', { api: down }),
      line('2026-10-26T10:15:00Z', { api: up }),
      line('2026-10-26T11:00:00Z', { api: down }),
    ].join('\n'),
  );
  assert.deepEqual(outages(records, 'api'), [
    { start: '2026-10-26T11:00:00Z', end: null, failedChecks: 1 },
    { start: '2026-10-26T10:05:00Z', end: '2026-10-26T10:15:00Z', failedChecks: 2 },
  ]);
});

test('latest returns the newest result for a monitor', () => {
  const records = parseHistory([line('2026-10-26T10:00:00Z', { api: up }), line('2026-10-26T10:05:00Z', { api: down })].join('\n'));
  assert.deepEqual(latest(records, 'api'), { t: '2026-10-26T10:05:00Z', ...down });
  assert.equal(latest(records, 'mx'), null);
});

test('buildModel reports when monitoring began and per-monitor state', () => {
  const records = parseHistory([line('2026-10-26T21:40:00Z', { api: up }), line('2026-10-26T21:45:00Z', { api: up })].join('\n'));
  const model = buildModel(records, [{ id: 'api', name: 'API', target: 'https://api.email/v1' }], {
    now: new Date('2026-10-26T21:50:00Z'),
    days: 90,
  });
  assert.equal(model.since, '2026-10-26T21:40:00Z');
  assert.equal(model.lastCheck, '2026-10-26T21:45:00Z');
  assert.equal(model.monitors[0].days.length, 90);
  assert.equal(model.monitors[0].uptime, 100);
  assert.deepEqual(model.monitors[0].outages, []);
});
