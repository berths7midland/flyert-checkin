import assert from "node:assert/strict";
import test from "node:test";

import { checkinCandidates, runFlyertCheckin } from "../worker/src/flyert-checkin.mjs";

function response(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      "content-type": init.contentType ?? "text/html; charset=utf-8",
      ...(init.headers ?? {})
    }
  });
}

test("fails before network requests when FLYERT_COOKIE is missing", async () => {
  const calls = [];

  const result = await runFlyertCheckin({
    env: {},
    fetchImpl: async (url) => {
      calls.push(url);
      return response("unexpected");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "missing_cookie");
  assert.equal(calls.length, 0);
});

test("reports login_required with safe homepage diagnostics", async () => {
  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async () => response("<html><a>\u767b\u5f55</a><a>\u6ce8\u518c</a></html>")
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "login_required");
  assert.equal(result.homepage.httpStatus, 200);
  assert.match(result.homepage.sample, /html/);
  assert.doesNotMatch(JSON.stringify(result), /discuz_uid|auth=abc/);
});

test("normalizes a copied Cookie header before sending requests", async () => {
  const requests = [];

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "Cookie: discuz_uid=123; auth=abc" },
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      return response("<html>\u6d88\u606f \u9000\u51fa</html>");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "unknown_response");
  assert.equal(requests[0].init.headers.cookie, "discuz_uid=123; auth=abc");
});

test("uses the mobile Flyert forum page for the default login check", async () => {
  const urls = [];

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async (url) => {
      urls.push(url);
      return response("<html>\u6d88\u606f \u9000\u51fa</html>");
    }
  });

  assert.equal(result.status, "unknown_response");
  assert.equal(urls[0], "https://www.flyert.com.cn/forum.php?gid=226&mobile=yes");
});

test("default check-in candidates skip the removed 404 dsu endpoint", () => {
  const urls = checkinCandidates({}, "https://www.flyert.com.cn");

  assert.deepEqual(urls, [
    "https://www.flyert.com.cn/plugin.php?id=k_misign:sign",
    "https://www.flyert.com.cn/sign.php?mobile=2",
    "https://www.flyert.com.cn/home.php?mod=task"
  ]);
});
test("also runs the mobile sign backup during the default check-in run", async () => {
  const urls = [];

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) {
        return response("<html>\u6d88\u606f \u9000\u51fa</html>");
      }
      if (url.endsWith("/plugin.php?id=k_misign:sign")) {
        return response("<html>\u7b7e\u5230\u6210\u529f</html>");
      }
      return response("<html>\u4eca\u65e5\u5df2\u7b7e\u5230</html>");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "checked_in");
  assert.ok(urls.includes("https://www.flyert.com.cn/sign.php?mobile=2"));
});
test("keeps the first already-checked sign page as the summary source", async () => {
  const logs = [];

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    logger: { log: (message) => logs.push(message) },
    fetchImpl: async (url) => {
      if (url.includes("forum.php?gid=226")) {
        return response("<html>\u6d88\u606f \u9000\u51fa</html>");
      }
      return response("<html>\u4eca\u65e5\u5df2\u7b7e\u5230</html>");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "already_checked");
  assert.equal(logs[0], "Flyert already checked in via https://www.flyert.com.cn/plugin.php?id=k_misign:sign");
});
test("decodes a GBK Flyert homepage before checking login state", async () => {
  const gbkLoggedIn = Uint8Array.from([0xcf, 0xfb, 0xcf, 0xa2, 0x20, 0xcd, 0xcb, 0xb3, 0xf6]);
  let requestCount = 0;

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return response(gbkLoggedIn, { contentType: "text/html; charset=gbk" });
      }
      return response("<html>\u7b7e\u5230\u6210\u529f</html>");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "checked_in");
});
test("returns already_checked when the sign page says today is complete", async () => {
  const urls = [];

  const result = await runFlyertCheckin({
    env: {
      FLYERT_COOKIE: "discuz_uid=123; auth=abc",
      FLYERT_CHECKIN_URL: "https://flyert.com.cn/plugin.php?id=k_misign:sign"
    },
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) {
        return response("<html><a>\u9000\u51fa</a><span>\u7b7e\u5230</span></html>");
      }
      return response("<html>\u4eca\u65e5\u5df2\u7b7e\u5230 \u660e\u5929\u518d\u6765</html>");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "already_checked");
  assert.equal(urls.length, 2);
});

test("returns checked_in when the sign page reports success", async () => {
  let requestCount = 0;

  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return response("<html>\u6b22\u8fce\u56de\u6765 <a>\u9000\u51fa</a></html>");
      }
      return response("<html>\u7b7e\u5230\u6210\u529f \u83b7\u5f97\u91cc\u7a0b</html>");
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "checked_in");
});

test("supports a GLaDOS-style configured POST request without notification hooks", async () => {
  const requests = [];

  const result = await runFlyertCheckin({
    env: {
      FLYERT_COOKIE: "discuz_uid=123; auth=abc",
      FLYERT_CHECKIN_URL: "https://flyert.com.cn/custom-checkin",
      FLYERT_CHECKIN_METHOD: "POST",
      FLYERT_CHECKIN_BODY: "formhash=abc&submit=1",
      FLYERT_SUCCESS_KEYWORDS: "custom ok",
      TG_BOT_TOKEN: "ignored"
    },
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      if (requests.length === 1) {
        return response("<html>\u6d88\u606f \u9000\u51fa</html>");
      }
      return response('{"message":"custom ok"}', {
        contentType: "application/json; charset=utf-8"
      });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "checked_in");
  assert.equal(requests[1].url, "https://flyert.com.cn/custom-checkin");
  assert.equal(requests[1].init.method, "POST");
  assert.equal(requests[1].init.body, "formhash=abc&submit=1");
  assert.equal(requests[1].init.headers["content-type"], "application/x-www-form-urlencoded");
});

test("surfaces cloudflare challenges as blocked", async () => {
  const result = await runFlyertCheckin({
    env: { FLYERT_COOKIE: "discuz_uid=123; auth=abc" },
    fetchImpl: async () =>
      response("<title>Just a moment...</title>", {
        status: 403,
        headers: { server: "cloudflare" }
      })
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "cloudflare_blocked");
});
