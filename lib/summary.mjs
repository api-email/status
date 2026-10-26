// Turns the raw check history (one JSON line per run) into what the page shows.
// Uptime is the share of successful checks; days before monitoring began have no checks and are shown as "no data".

/** One record per line: { t: ISO time, results: { [monitorId]: { ok, ms, code?, error?, retried? } } }. */
export function parseHistory(text) {
  const records = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const record = JSON.parse(raw);
      if (typeof record?.t === 'string' && record.results && typeof record.results === 'object') records.push(record);
    } catch {
      // A line cut short by a failed run: skip it rather than lose the whole history.
    }
  }
  return records.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `days` entries ending with `today` (UTC dates), oldest first. */
export function dailyStats(records, id, { days, today }) {
  const first = addDays(today, -(days - 1));
  const byDate = new Map();
  for (let i = 0; i < days; i++) byDate.set(addDays(first, i), { up: 0, total: 0 });
  for (const record of records) {
    const result = record.results[id];
    const day = byDate.get(record.t.slice(0, 10));
    if (!result || !day) continue;
    day.total++;
    if (result.ok) day.up++;
  }
  return [...byDate].map(([date, { up, total }]) => ({ date, up, total }));
}

export function uptimePercent(stats) {
  let up = 0;
  let total = 0;
  for (const s of stats) {
    up += s.up;
    total += s.total;
  }
  return total === 0 ? null : (up / total) * 100;
}

/** Runs of consecutive failed checks, newest first. `end` is the next successful check, or null while ongoing. */
export function outages(records, id) {
  return scanOutages(records, id).map(({ reason, ...o }) => o);
}

/** Like `outages`, with `reason`: what the last failed check of each run saw. */
function scanOutages(records, id) {
  const found = [];
  let open = null;
  for (const record of records) {
    const result = record.results[id];
    if (!result) continue;
    if (!result.ok) {
      if (open) open.failedChecks++;
      else open = { start: record.t, end: null, failedChecks: 1 };
      open.reason = describe(result);
    } else if (open) {
      found.push({ ...open, end: record.t });
      open = null;
    }
  }
  if (open) found.push(open);
  return found.reverse();
}

export function describe(result) {
  if (result.code) return `HTTP ${result.code}`;
  return result.error ?? 'failed';
}

export function latest(records, id) {
  for (let i = records.length - 1; i >= 0; i--) {
    const result = records[i].results[id];
    if (result) return { t: records[i].t, ...result };
  }
  return null;
}

export function buildModel(records, monitors, { now, days }) {
  const today = now.toISOString().slice(0, 10);
  const windowStart = `${addDays(today, -(days - 1))}T00:00:00Z`;
  return {
    generatedAt: now.toISOString(),
    since: records[0]?.t ?? null,
    lastCheck: records.at(-1)?.t ?? null,
    days,
    monitors: monitors.map((m) => {
      const stats = dailyStats(records, m.id, { days, today });
      return {
        id: m.id,
        name: m.name,
        target: m.target,
        latest: latest(records, m.id),
        days: stats,
        uptime: uptimePercent(stats),
        outages: scanOutages(records, m.id).filter((o) => (o.end ?? now.toISOString()) >= windowStart),
      };
    }),
  };
}
