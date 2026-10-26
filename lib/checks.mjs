import { connect } from 'node:net';

const USER_AGENT = 'api-email-status (+https://status.api.email)';

/** GET `url`: up on a 2xx answer, read to the end within `timeout` ms. */
export async function checkHttp(url, { timeout = 10_000 } = {}) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': USER_AGENT } });
    await response.arrayBuffer();
    const ms = elapsed(started);
    return { ok: response.status >= 200 && response.status < 300, ms, code: response.status };
  } catch (error) {
    return { ok: false, ms: elapsed(started), error: controller.signal.aborted ? 'timeout' : errorCode(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** Connects to an SMTP server: up when it greets with 220 within `timeout` ms. Says QUIT and sends no mail. */
export function checkSmtp(host, port, { timeout = 10_000 } = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    let buffer = '';
    let done = false;
    const socket = connect({ host, port });
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...result, ms: elapsed(started) });
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: 'timeout' });
      socket.destroy();
    }, timeout);
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      const end = buffer.indexOf('\n');
      if (end === -1) return;
      const greeting = buffer.slice(0, end).trim();
      if (/^220[ -]/.test(greeting)) {
        finish({ ok: true });
        socket.end('QUIT\r\n');
      } else {
        finish({ ok: false, error: `greeting ${greeting.slice(0, 100)}` });
        socket.destroy();
      }
    });
    socket.on('error', (error) => finish({ ok: false, error: errorCode(error) }));
    socket.on('close', () => finish({ ok: false, error: 'closed without a greeting' }));
  });
}

/** One retry after `delay` ms, so a single dropped packet on the runner is not reported as an outage. */
export async function withRetry(check, { delay = 5_000 } = {}) {
  const first = await check();
  if (first.ok) return first;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return { ...(await check()), retried: true };
}

function elapsed(started) {
  return Math.round(performance.now() - started);
}

function errorCode(error) {
  return error?.cause?.code ?? error?.code ?? error?.message ?? String(error);
}
