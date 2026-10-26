import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { DISPATCH_URL, dispatch } from '../trigger/worker.mjs';

const recorder = (status, body = '') => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : body, { status });
  };
  return { calls, fetchImpl };
};

test('dispatch starts the check workflow on main with the token', async () => {
  const { calls, fetchImpl } = recorder(204);
  await dispatch('tok123', fetchImpl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/api-email/status/actions/workflows/check.yml/dispatches');
  assert.equal(calls[0].url, DISPATCH_URL);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer tok123');
  assert.deepEqual(JSON.parse(calls[0].init.body), { ref: 'main' });
});

test('dispatch fails loudly when GitHub refuses, so the Worker logs show it', async () => {
  const { fetchImpl } = recorder(401, '{"message":"Bad credentials"}');
  await assert.rejects(dispatch('expired', fetchImpl), /HTTP 401.*Bad credentials/);
});

test('the scheduled handler dispatches with the GITHUB_TOKEN secret', async () => {
  const { calls, fetchImpl } = recorder(204);
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await worker.scheduled({}, { GITHUB_TOKEN: 'secret' });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls[0].init.headers.authorization, 'Bearer secret');
});
