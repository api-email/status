import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { checkHttp, checkSmtp, withRetry } from '../lib/checks.mjs';

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

test('checkHttp: a 2xx answer is up and records the status code', async (t) => {
  const server = createServer((_req, res) => res.end('{"status":"ready"}'));
  t.after(() => server.close());
  const port = await listen(server);
  const result = await checkHttp(`http://127.0.0.1:${port}/readyz`);
  assert.equal(result.ok, true);
  assert.equal(result.code, 200);
  assert.equal(typeof result.ms, 'number');
});

test('checkHttp: a 5xx answer is down', async (t) => {
  const server = createServer((_req, res) => {
    res.statusCode = 503;
    res.end('{"status":"degraded"}');
  });
  t.after(() => server.close());
  const port = await listen(server);
  const result = await checkHttp(`http://127.0.0.1:${port}/readyz`);
  assert.equal(result.ok, false);
  assert.equal(result.code, 503);
});

test('checkHttp: no answer within the timeout is down with error "timeout"', async (t) => {
  const server = createServer(() => {}); // never answers
  t.after(() => server.close(() => {}));
  t.after(() => server.closeAllConnections());
  const port = await listen(server);
  const result = await checkHttp(`http://127.0.0.1:${port}/`, { timeout: 200 });
  assert.deepEqual({ ok: result.ok, error: result.error }, { ok: false, error: 'timeout' });
});

test('checkHttp: a refused connection is down with a short error', async () => {
  const result = await checkHttp('http://127.0.0.1:1/', { timeout: 2000 });
  assert.equal(result.ok, false);
  assert.match(result.error, /ECONNREFUSED|fetch failed/);
});

test('checkSmtp: a 220 greeting is up, and the probe says QUIT', async (t) => {
  let got = '';
  const server = createTcpServer((socket) => {
    socket.write('220 mx.api.email ESMTP\r\n');
    socket.on('data', (d) => {
      got += d;
      socket.end('221 bye\r\n');
    });
  });
  t.after(() => server.close());
  const port = await listen(server);
  const result = await checkSmtp('127.0.0.1', port);
  assert.equal(result.ok, true);
  await new Promise((r) => setTimeout(r, 50));
  assert.match(got, /^QUIT\r\n/);
});

test('checkSmtp: a 554 greeting is down', async (t) => {
  const server = createTcpServer((socket) => socket.end('554 no service\r\n'));
  t.after(() => server.close());
  const port = await listen(server);
  const result = await checkSmtp('127.0.0.1', port);
  assert.deepEqual({ ok: result.ok, error: result.error }, { ok: false, error: 'greeting 554 no service' });
});

test('checkSmtp: no greeting within the timeout is down', async (t) => {
  const sockets = [];
  const server = createTcpServer((socket) => sockets.push(socket)); // silent
  t.after(() => {
    for (const s of sockets) s.destroy();
    server.close();
  });
  const port = await listen(server);
  const result = await checkSmtp('127.0.0.1', port, { timeout: 200 });
  assert.deepEqual({ ok: result.ok, error: result.error }, { ok: false, error: 'timeout' });
});

test('withRetry: a failure is retried once after the delay, and the retry is recorded', async () => {
  let calls = 0;
  const result = await withRetry(async () => (++calls === 1 ? { ok: false, error: 'timeout' } : { ok: true, ms: 5 }), { delay: 10 });
  assert.equal(calls, 2);
  assert.deepEqual(result, { ok: true, ms: 5, retried: true });
});

test('withRetry: a success is not retried', async () => {
  let calls = 0;
  const result = await withRetry(async () => (calls++, { ok: true, ms: 5 }), { delay: 10 });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, ms: 5 });
});
