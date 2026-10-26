// What status.api.email checks. `target` is what the page shows; `check` runs one probe.
import { checkHttp, checkSmtp } from './checks.mjs';

export const MONITORS = [
  { id: 'api', name: 'API', target: 'https://api.email/v1', check: () => checkHttp('https://api.email/readyz') },
  { id: 'website', name: 'Website', target: 'https://api.email', check: () => checkHttp('https://api.email/') },
  { id: 'mx', name: 'Inbound mail', target: 'mx.api.email:25', check: () => checkSmtp('mx.api.email', 25) },
];
