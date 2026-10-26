// Cloudflare Worker that starts the check workflow every 5 minutes (see wrangler.toml).
// GitHub's own schedule is best-effort: it can skip runs or start an hour late, which would leave the page stale.
// The checks themselves still run on GitHub's runners; this only says "run now".

export const DISPATCH_URL = 'https://api.github.com/repos/api-email/status/actions/workflows/check.yml/dispatches';

export async function dispatch(token, fetchImpl = fetch) {
  const response = await fetchImpl(DISPATCH_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'api-email-status-trigger',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (response.status !== 204) {
    throw new Error(`workflow dispatch failed: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
}

export default {
  async scheduled(_event, env) {
    await dispatch(env.GITHUB_TOKEN);
  },
};
