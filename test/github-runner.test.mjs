import assert from "node:assert/strict";
import test from "node:test";

import { runGithubCheckin } from "../scripts/github-checkin.mjs";

function response(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

test("GitHub runner returns exit code 0 when check-in succeeds", async () => {
  let calls = 0;

  const outcome = await runGithubCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return response("<html>\u6d88\u606f \u9000\u51fa</html>");
      return response("<html>check-in succeed</html>");
    },
    logger: { log() {}, error() {} }
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.result.status, "checked_in");
});

test("GitHub runner returns exit code 1 when configuration is missing", async () => {
  const outcome = await runGithubCheckin({
    env: {},
    fetchImpl: async () => response("unexpected"),
    logger: { log() {}, error() {} }
  });

  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.result.status, "missing_cookie");
});
