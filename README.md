# api.email status

Source and history of [status.api.email](https://status.api.email).

Every 5 minutes (as often as GitHub's scheduler allows), the [check workflow](.github/workflows/check.yml) runs from GitHub Actions, outside api.email's own network:

| Service | Check | Up when |
|---|---|---|
| API | `GET https://api.email/readyz` (also reaches the database) | HTTP 2xx within 10 s |
| Website | `GET https://api.email/` | HTTP 2xx within 10 s |
| Inbound mail | TCP `mx.api.email:25`, read the greeting, `QUIT` | SMTP `220` within 10 s |

A failed check is retried once after 5 seconds. Each run appends one JSON line per check to `data/<UTC date>.ndjson` and commits it, so the history in this repository is the record behind the page. The page is rebuilt from the last 90 days and published with GitHub Pages; [status.json](https://status.api.email/status.json) has the same data.

```bash
npm test         # unit tests, no dependencies
node check.mjs   # run the checks once and append to data/
node build.mjs   # render public/index.html and public/status.json
```
