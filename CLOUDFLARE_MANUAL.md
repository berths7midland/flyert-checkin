# Cloudflare Manual Setup

Use this when Cloudflare automatic upload or Pages deployment hangs. The code is already in this repository; you can copy files manually or use Cloudflare's dashboard.

## Option A: Worker cron project

Use these files:

```text
worker/src/index.mjs
worker/src/flyert-checkin.mjs
wrangler.toml
```

If Cloudflare dashboard only accepts a single Worker file, keep this repository as the source and use GitHub Actions as the scheduler instead. The dashboard editor is not ideal for this multi-file Worker.

Cron times in `wrangler.toml`:

```text
20 0 * * *
40 12 * * *
```

They run at about `08:20` and `20:40` Beijing/Singapore time.

## Option B: Pages Functions `/run`

Use these files:

```text
functions/run.js
worker/src/flyert-checkin.mjs
wrangler.pages.toml
public/.keep
```

Pages Functions provide a manual endpoint:

```text
https://<your-pages-project>.pages.dev/run?token=<RUN_TOKEN>
```

Pages Functions are not the main scheduler here. Use GitHub Actions for the twice-daily schedule, or Cloudflare Worker cron if you deploy the Worker version.

## Required secret

Set this in Cloudflare Worker or Pages settings:

```text
FLYERT_COOKIE
```

Value example:

```text
discuz_uid=...; discuz_auth=...; cf_clearance=...
```

Do not paste cookies into source files.

## Optional parameters

Set these later after capturing the real Flyert request:

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
FLYERT_SKIP_HOME_CHECK
RUN_TOKEN
```

Recommended values after capture:

```text
FLYERT_CHECKIN_METHOD=POST
FLYERT_CHECKIN_CONTENT_TYPE=application/x-www-form-urlencoded
FLYERT_SUCCESS_KEYWORDS=<success text from response>
FLYERT_ALREADY_KEYWORDS=<already checked text from response>
```

`FLYERT_EXTRA_HEADERS` must be JSON, for example:

```json
{"x-requested-with":"XMLHttpRequest"}
```

## No Telegram

There is no Telegram Bot push logic. The result is visible in Cloudflare logs and GitHub Actions logs.
