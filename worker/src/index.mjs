import { runFlyertCheckin } from "./flyert-checkin.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/run" && url.pathname !== "/") {
      return json({ ok: false, status: "not_found" }, 404);
    }

    if (env.RUN_TOKEN) {
      const token = url.searchParams.get("token") || request.headers.get("x-run-token");
      if (token !== env.RUN_TOKEN) {
        return json({ ok: false, status: "unauthorized" }, 401);
      }
    }

    const result = await runFlyertCheckin({ env, fetchImpl: fetch, logger: console });
    ctx.waitUntil(Promise.resolve(console.log(JSON.stringify(result))));

    return json(result, result.ok ? 200 : 500);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runFlyertCheckin({ env, fetchImpl: fetch, logger: console }).then((result) => {
        console.log(JSON.stringify({ cron: event.cron, ...result }));
      })
    );
  }
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
