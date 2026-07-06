import { runFlyertCheckin } from "../worker/src/flyert-checkin.mjs";

export async function onRequest(context, options = {}) {
  const request = context.request;
  const env = context.env || {};
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;

  if (env.RUN_TOKEN) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("x-run-token");
    if (token !== env.RUN_TOKEN) {
      return json({ ok: false, status: "unauthorized" }, 401);
    }
  }

  const result = await runFlyertCheckin({ env, fetchImpl, logger });
  context.waitUntil?.(Promise.resolve(logger.log?.(JSON.stringify(result))));

  return json(result, result.ok ? 200 : 500);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
