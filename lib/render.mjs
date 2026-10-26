// Renders the status page as one static HTML file: inline CSS, no external requests,
// so it stays readable when api.email itself is down.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const longDate = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const shortDate = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
};
const time = (iso) => `${shortDate(iso)}, ${iso.slice(11, 16)} UTC`;
const percent = (p) => (p === null ? '—' : `${Number(p.toFixed(2))}%`);
const duration = (from, to) => {
  const minutes = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

function dayCell(day) {
  if (day.total === 0) return `<i class="d nodata" title="${esc(shortDate(day.date))}: no data"></i>`;
  const state = day.up === day.total ? 'up' : day.up === 0 ? 'down' : 'partial';
  const title = `${shortDate(day.date)}: ${percent((day.up / day.total) * 100)} (${day.up} of ${day.total} checks)`;
  return `<i class="d ${state}" title="${esc(title)}"></i>`;
}

function monitorBlock(m, days) {
  const state = m.latest === null ? ['nodata', 'No data'] : m.latest.ok ? ['up', 'Operational'] : ['down', 'Down'];
  return `
      <section class="mon">
        <div class="mhead">
          <div><b>${esc(m.name)}</b> <code>${esc(m.target)}</code></div>
          <div class="state ${state[0]}">${state[1]}</div>
        </div>
        <div class="bar" role="img" aria-label="${esc(`${m.name}: daily availability over the last ${days} days`)}">${m.days.map(dayCell).join('')}</div>
        <div class="axis"><span>${days} days ago</span><span>${percent(m.uptime)} uptime</span><span>Today</span></div>
      </section>`;
}

function outageRows(model) {
  const rows = model.monitors
    .flatMap((m) => m.outages.map((o) => ({ ...o, name: m.name })))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  if (rows.length === 0) {
    return `<p class="muted">No outages detected since monitoring began.</p>`;
  }
  return `<table>
        <thead><tr><th>Service</th><th>Started</th><th>Duration</th><th>Last error</th></tr></thead>
        <tbody>${rows
          .map(
            (o) =>
              `<tr><td>${esc(o.name)}</td><td>${esc(time(o.start))}</td><td>${o.end ? esc(duration(o.start, o.end)) : '<b class="down">ongoing</b>'}</td><td><code>${esc(o.reason ?? '')}</code></td></tr>`,
          )
          .join('')}</tbody>
      </table>`;
}

export function renderPage(model) {
  const any = model.lastCheck !== null;
  const down = model.monitors.some((m) => m.latest && !m.latest.ok);
  const banner = !any
    ? ['nodata', 'No checks yet']
    : down
      ? ['down', 'Some systems are down']
      : ['up', 'All systems operational'];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>api.email status</title>
<meta name="description" content="Availability of the api.email API, website and inbound mail servers, checked every 5 minutes.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>
:root{--paper:#f6f5f1;--paper2:#efede6;--ink:#111;--mute:#6b6a65;--line:#e3e0d6;--acc:#ff5a1f;--ok:#1a7f37;--warn:#b7791f;--err:#c4321b;--none:#dcd9cf;
  --sans:"Geist Variable","Geist",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"Geist Mono Variable","Geist Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 var(--sans)}
.wrap{max-width:760px;margin:0 auto;padding:32px 16px 64px}
header{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:28px}
.wmark{font-weight:650;font-size:20px;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.wmark span{color:var(--acc)}
header a.back{color:var(--mute);text-decoration:none}
header a.back:hover{color:var(--ink)}
.banner{border:1px solid var(--line);background:#fff;padding:18px 20px;font-weight:600;font-size:18px;display:flex;align-items:center;gap:12px}
.banner::before{content:"";width:12px;height:12px;border-radius:50%;background:var(--none);flex:none}
.banner.up::before{background:var(--ok)}.banner.down::before{background:var(--err)}
.meta{color:var(--mute);font-size:13px;margin:10px 2px 28px}
.mon{border:1px solid var(--line);background:#fff;padding:16px 20px;margin-top:-1px}
.mhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
code{font-family:var(--mono);font-size:12.5px;color:var(--mute)}
.state{font-weight:600}.state.up{color:var(--ok)}.state.down,b.down{color:var(--err)}.state.nodata{color:var(--mute)}
.bar{display:flex;gap:2px;height:34px}
.d{flex:1;min-width:0;border-radius:2px;background:var(--none)}
.d.up{background:var(--ok)}.d.partial{background:var(--warn)}.d.down{background:var(--err)}
.axis{display:flex;justify-content:space-between;color:var(--mute);font-size:12px;margin-top:6px}
h2{font-size:16px;margin:40px 0 10px}
.muted{color:var(--mute)}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);font-size:14px}
th,td{text-align:left;padding:8px 12px;border-top:1px solid var(--line)}
th{font-weight:600;background:var(--paper2)}
.tbl{overflow-x:auto}
footer{margin-top:40px;color:var(--mute);font-size:13px}
footer a{color:var(--mute)}
.stale{display:none;border:1px solid var(--warn);background:#fff8eb;padding:10px 14px;margin:0 0 16px;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="wmark" href="https://api.email">api<span>.</span>email <span style="color:var(--mute);font-weight:400">status</span></a>
    <a class="back" href="https://api.email">api.email →</a>
  </header>
  <p class="stale" id="stale">The latest check is more than 30 minutes old, so the state below may be out of date.</p>
  <div class="banner ${banner[0]}">${banner[1]}</div>
  <p class="meta">${
    any
      ? `Monitoring since ${esc(longDate(model.since))}. Last check: <time datetime="${esc(model.lastCheck)}">${esc(time(model.lastCheck))}</time>.`
      : 'Monitoring has just been set up.'
  }</p>
  ${model.monitors.map((m) => monitorBlock(m, model.days)).join('')}
  <h2>Outages, last ${model.days} days</h2>
  <div class="tbl">${outageRows(model)}</div>
  <footer>
    <p>
      Each service is checked about every 5 minutes from GitHub Actions, outside our own network. A check fails when the
      API or website does not answer with HTTP 2xx within 10 seconds, or when <code>mx.api.email</code> does not greet
      with SMTP 220; a failed check is retried once after 5 seconds. The API check calls
      <code>https://api.email/readyz</code>, which also reaches the database. Uptime is the share of successful checks.
      Grey days are before monitoring began.
    </p>
    <p>
      Every check result is committed to <a href="https://github.com/api-email/status">github.com/api-email/status</a>,
      so this history can be verified. Machine-readable: <a href="status.json">status.json</a>.
    </p>
  </footer>
</div>
<script>
(function(){var t=document.querySelector('time');if(t&&Date.now()-Date.parse(t.getAttribute('datetime'))>30*60*1000)document.getElementById('stale').style.display='block';})();
</script>
</body>
</html>
`;
}
