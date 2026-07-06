import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "../functions/run.js";

function response(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

test("Pages Function /run returns check-in result", async () => {
  let calls = 0;
  const context = {
    request: new Request("https://example.pages.dev/run"),
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    waitUntil() {},
    data: {},
    next() {},
    params: {}
  };

  const result = await onRequest(context, {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return response("<html>\u6d88\u606f \u9000\u51fa</html>");
      return response("<html>check-in succeed</html>");
    },
    logger: { log() {}, error() {} }
  });

  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "checked_in");
});

test("Pages Function /run rejects requests without the configured token", async () => {
  const result = await onRequest(
    {
      request: new Request("https://example.pages.dev/run"),
      env: { RUN_TOKEN: "secret", FLYERT_COOKIE: "discuz_uid=123" },
      waitUntil() {},
      data: {},
      next() {},
      params: {}
    },
    { fetchImpl: async () => response("unexpected"), logger: { log() {}, error() {} } }
  );

  assert.equal(result.status, 401);
  const payload = await result.json();
  assert.equal(payload.status, "unauthorized");
}
);
