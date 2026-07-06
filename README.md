# Flyert Automated Check-in

This project follows the common GLaDOS check-in pattern: one small request runner, secrets injected by the platform, scheduled execution, and plain logs only. It intentionally does not send Telegram Bot notifications.

It contains three deployable entry points that share the same check-in logic:

- Cloudflare Worker with cron triggers.
- Cloudflare Pages Functions `/run` endpoint.
- GitHub Actions with scheduled workflows.

The Worker and GitHub workflow both run twice per day:

- `20 0 * * *` UTC, about `08:20` Beijing/Singapore time.
- `40 12 * * *` UTC, about `20:40` Beijing/Singapore time as a catch-up run.

The exact Flyert request parameters can be supplied later through environment variables/secrets.

## Files

- `worker/src/flyert-checkin.mjs`: shared check-in logic.
- `worker/src/index.mjs`: Cloudflare Worker `fetch` and `scheduled` handlers.
- `functions/run.js`: Cloudflare Pages Functions `/run` handler.
- `scripts/github-checkin.mjs`: GitHub Actions command-line runner.
- `.github/workflows/flyert-checkin.yml`: GitHub Actions schedule.
- `wrangler.toml`: Cloudflare Worker configuration and cron triggers.
- `wrangler.pages.toml`: Cloudflare Pages Functions configuration.
- `test/*.test.mjs`: local behavior tests.

## Required Secret

Set this secret in Cloudflare and GitHub:

```text
FLYERT_COOKIE
```

Use the full Cookie header value from your logged-in browser session, for example:

```text
discuz_uid=...; discuz_auth=...; cf_clearance=...
```

Do not commit Cookie values into this repository.

## GLaDOS-style Parameters

These are optional and can be filled in after the real Flyert check-in request is captured:

```text
FLYERT_CHECKIN_URL
FLYERT_CHECKIN_METHOD
FLYERT_CHECKIN_BODY
FLYERT_CHECKIN_CONTENT_TYPE
FLYERT_SUCCESS_KEYWORDS
FLYERT_ALREADY_KEYWORDS
FLYERT_EXTRA_HEADERS
FLYERT_REFERER
FLYERT_USER_AGENT
FLYERT_BASE_URL
FLYERT_HOME_URL
FLYERT_SKIP_HOME_CHECK
RUN_TOKEN
```

Recommended mapping:

- `FLYERT_CHECKIN_URL`: exact check-in URL.
- `FLYERT_CHECKIN_METHOD`: `GET` or `POST`; defaults to `POST` when `FLYERT_CHECKIN_BODY` is set, otherwise `GET`.
- `FLYERT_CHECKIN_BODY`: form or JSON payload copied from DevTools.
- `FLYERT_CHECKIN_CONTENT_TYPE`: defaults to `application/x-www-form-urlencoded` when a body is sent.
- `FLYERT_SUCCESS_KEYWORDS`: comma/newline/pipe separated success markers, for example `check-in succeed,signin ok`.
- `FLYERT_ALREADY_KEYWORDS`: comma/newline/pipe separated already-done markers.
- `FLYERT_EXTRA_HEADERS`: JSON object, for example `{ "x-requested-with": "XMLHttpRequest" }`.
- `FLYERT_REFERER`: referer header if the captured request needs a specific page.
- `FLYERT_USER_AGENT`: browser User-Agent if Flyert requires it.
- `FLYERT_BASE_URL`: defaults to `https://www.flyert.com.cn`.
- `FLYERT_HOME_URL`: login probe page; defaults to `https://www.flyert.com.cn/forum.php?gid=226&mobile=yes`.
- `FLYERT_SKIP_HOME_CHECK`: set to `true` if the captured check-in endpoint is enough and the homepage login check gets in the way.
- `RUN_TOKEN`: protects manual Cloudflare Worker/Pages `/run` calls.

No Telegram Bot variables are used. Values such as `TG_BOT_TOKEN` are ignored.

Default candidate URLs tried before `FLYERT_CHECKIN_URL` is known:

```text
https://www.flyert.com.cn/plugin.php?id=k_misign:sign
https://www.flyert.com.cn/sign.php?mobile=2
https://www.flyert.com.cn/plugin.php?id=dsu_paulsign:sign
https://www.flyert.com.cn/home.php?mod=task
```

## Cloudflare Worker

Deploy the cron Worker:

```powershell
wrangler login
wrangler secret put FLYERT_COOKIE
wrangler deploy
```

Set optional secrets as needed:

```powershell
wrangler secret put FLYERT_CHECKIN_URL
wrangler secret put FLYERT_CHECKIN_METHOD
wrangler secret put FLYERT_CHECKIN_BODY
wrangler secret put FLYERT_SUCCESS_KEYWORDS
wrangler secret put FLYERT_ALREADY_KEYWORDS
wrangler secret put FLYERT_USER_AGENT
wrangler secret put RUN_TOKEN
```

Manual run:

```text
https://<your-worker>.<your-subdomain>.workers.dev/run?token=<RUN_TOKEN>
```

If `RUN_TOKEN` is not set, `/run` is open. Set `RUN_TOKEN` before exposing the Worker URL.

## Cloudflare Pages Functions

Deploy the Pages endpoint:

```powershell
wrangler pages deploy public --project-name flyert-checkin-pages --compatibility-date 2026-07-06
```

Then set the same environment variables/secrets in the Cloudflare Pages project settings.

Manual run:

```text
https://<your-pages-project>.pages.dev/run?token=<RUN_TOKEN>
```

Pages Functions provide the `/run` endpoint. Scheduling should be done by the Worker cron or GitHub Actions.

## GitHub Actions

Push this directory as a GitHub repository, then set repository secrets:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Required:

```text
FLYERT_COOKIE
```

Optional repository secrets:

```text
FLYERT_CHECKIN_URL
FLYERT_CHECKIN_METHOD
FLYERT_CHECKIN_BODY
FLYERT_CHECKIN_CONTENT_TYPE
FLYERT_SUCCESS_KEYWORDS
FLYERT_ALREADY_KEYWORDS
FLYERT_EXTRA_HEADERS
FLYERT_REFERER
FLYERT_USER_AGENT
FLYERT_SKIP_HOME_CHECK
```

Optional repository variable:

```text
FLYERT_BASE_URL
FLYERT_HOME_URL
```

The workflow can also be run manually from:

```text
Actions -> Flyert Check-in -> Run workflow
```

## Capture the Real Check-in Request Later

If either platform returns `unknown_response`, capture the real request:

1. Open Flyert in Chrome while logged in.
2. Press `F12`, open `Network`.
3. Click the top-right check-in link.
4. Find the request that returns success or "already checked".
5. Copy the URL, method, request body, content type, and any special headers.
6. Fill the matching environment variables above.

## Local Tests

```powershell
npm.cmd test
```

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.
