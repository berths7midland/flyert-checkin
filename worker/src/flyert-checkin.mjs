const DEFAULT_HOME_URL = "https://www.flyert.com.cn/forum.php?gid=226&mobile=yes";
const DEFAULT_BASE_URL = "https://www.flyert.com.cn";
const DEFAULT_CHECKIN_PATHS = [
  "/plugin.php?id=k_misign:sign",
  "/sign.php?mobile=2",
  "/home.php?mod=task"
];

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const DEFAULT_ALREADY_PATTERNS = [
  /\u5df2\u7b7e\u5230/,
  /\u4eca\u65e5.*\u5df2.*\u7b7e/,
  /\u5df2\u7ecf.*\u7b7e\u5230/,
  /\u660e\u5929\u518d\u6765/,
  /already\s*(checked|signed)/i
];

const DEFAULT_SUCCESS_PATTERNS = [
  /\u7b7e\u5230\u6210\u529f/,
  /\u6253\u5361\u6210\u529f/,
  /\u6210\u529f\u7b7e\u5230/,
  /\u83b7\u5f97.*(\u79ef\u5206|\u91cc\u7a0b|\u98de\u7c73|\u5956\u52b1)/,
  /check.?in\s*succeed/i
];

export async function runFlyertCheckin(options = {}) {
  const env = options.env ?? {};
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console;
  const cookie = normalizeSecret(env.FLYERT_COOKIE);

  if (!cookie) {
    return result(false, "missing_cookie", "Set FLYERT_COOKIE as a secret.");
  }

  const homeUrl = env.FLYERT_HOME_URL || DEFAULT_HOME_URL;
  const baseUrl = trimTrailingSlash(env.FLYERT_BASE_URL || originOf(homeUrl) || DEFAULT_BASE_URL);
  const headers = buildHeaders({
    cookie,
    userAgent: env.FLYERT_USER_AGENT || DEFAULT_USER_AGENT,
    referer: homeUrl
  });

  if (!truthy(env.FLYERT_SKIP_HOME_CHECK)) {
    const homepage = await fetchText(fetchImpl, homeUrl, { headers });
    const homepageBlock = classifyBlocking(homepage);
    if (homepageBlock) return homepageBlock;

    if (!looksLoggedIn(homepage.text)) {
      return result(false, "login_required", "Cookie did not produce a logged-in Flyert homepage.", { homepage: pageDiagnostics(homepage) });
    }
  }

  const checkinUrls = checkinCandidates(env, baseUrl);
  const attempts = [];
  let bestStatus = "unknown";
  let bestUrl = "";
  for (const url of checkinUrls) {
    const requestInit = buildCheckinRequestInit(env, headers, baseUrl);
    const page = await fetchText(fetchImpl, url, requestInit);
    const pageBlock = classifyBlocking(page);
    if (pageBlock) return pageBlock;

    const status = classifyCheckinText(page.text, env);
    attempts.push({
      url,
      httpStatus: page.status,
      method: requestInit.method,
      status,
      sample: compactText(page.text).slice(0, 220)
    });

    if (status === "checked_in") {
      bestStatus = "checked_in";
      bestUrl = url;
    } else if (status === "already_checked" && bestStatus === "unknown") {
      bestStatus = "already_checked";
      bestUrl = url;
    }
  }

  if (bestStatus === "checked_in") {
    logger.log?.(`Flyert check-in succeeded via ${bestUrl}`);
    return result(true, "checked_in", "Flyert check-in succeeded.", { attempts });
  }

  if (bestStatus === "already_checked") {
    logger.log?.(`Flyert already checked in via ${bestUrl}`);
    return result(true, "already_checked", "Flyert already checked in today.", { attempts });
  }

  return result(
    false,
    "unknown_response",
    "No candidate check-in endpoint returned a known success response. Set FLYERT_CHECKIN_URL and optional method/body/keywords from the captured request.",
    { attempts }
  );
}

export function checkinCandidates(env = {}, baseUrl = DEFAULT_BASE_URL) {
  if (env.FLYERT_CHECKIN_URL) {
    return [absoluteUrl(env.FLYERT_CHECKIN_URL, baseUrl)];
  }

  return DEFAULT_CHECKIN_PATHS.map((path) => absoluteUrl(path, baseUrl));
}

export function buildCheckinRequestInit(env = {}, baseHeaders = {}, baseUrl = DEFAULT_BASE_URL) {
  const method = normalizeMethod(env.FLYERT_CHECKIN_METHOD || (env.FLYERT_CHECKIN_BODY ? "POST" : "GET"));
  const headers = {
    ...baseHeaders,
    referer: env.FLYERT_REFERER || `${trimTrailingSlash(baseUrl)}/`
  };

  const extraHeaders = parseExtraHeaders(env.FLYERT_EXTRA_HEADERS);
  Object.assign(headers, extraHeaders);

  const init = {
    method,
    redirect: "follow",
    headers
  };

  if (env.FLYERT_CHECKIN_BODY && method !== "GET" && method !== "HEAD") {
    init.body = env.FLYERT_CHECKIN_BODY;
    if (!hasHeader(headers, "content-type")) {
      headers["content-type"] = env.FLYERT_CHECKIN_CONTENT_TYPE || "application/x-www-form-urlencoded";
    }
  }

  return init;
}

export function classifyCheckinText(text = "", env = {}) {
  const normalized = compactText(text);
  const alreadyKeywords = splitKeywords(env.FLYERT_ALREADY_KEYWORDS);
  const successKeywords = splitKeywords(env.FLYERT_SUCCESS_KEYWORDS);

  if (alreadyKeywords.some((keyword) => normalized.includes(keyword))) {
    return "already_checked";
  }

  if (successKeywords.some((keyword) => normalized.includes(keyword))) {
    return "checked_in";
  }

  if (DEFAULT_ALREADY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "already_checked";
  }

  if (DEFAULT_SUCCESS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "checked_in";
  }

  return "unknown";
}

export function looksLoggedIn(text = "") {
  const normalized = compactText(text);

  if (/\u9000\u51fa|\u6ce8\u9500|\u6d88\u606f|\u63d0\u9192|\u6211\u7684|\u4e2a\u4eba\u4e2d\u5fc3|\u7528\u6237\u4e2d\u5fc3/.test(normalized)) return true;
  if (/\u767b\u5f55|\u7acb\u5373\u767b\u5f55|\u6ce8\u518c/.test(normalized) && !/\u9000\u51fa|\u6d88\u606f|\u63d0\u9192/.test(normalized)) return false;

  return false;
}

function classifyBlocking(page) {
  const server = page.headers.get("server") || "";
  const text = compactText(page.text);

  if (
    page.status === 403 ||
    /cloudflare/i.test(server) ||
    /Just a moment|Checking your browser|cf-chl|challenge-platform|Attention Required/i.test(text)
  ) {
    return result(
      false,
      "cloudflare_blocked",
      "Cloudflare challenged this request. Refresh FLYERT_COOKIE/clearance from a browser session or run from another trusted environment.",
      { httpStatus: page.status, sample: text.slice(0, 220) }
    );
  }

  return null;
}

async function fetchText(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);

  return {
    url,
    status: response.status,
    headers: response.headers,
    text: await decodeResponseText(response)
  };
}

async function decodeResponseText(response) {
  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();

  if (/charset\s*=\s*(gbk|gb2312|gb18030)/i.test(contentType)) {
    try {
      return new TextDecoder("gb18030").decode(buffer);
    } catch {
      return new TextDecoder("utf-8").decode(buffer);
    }
  }

  return new TextDecoder("utf-8").decode(buffer);
}

function buildHeaders({ cookie, userAgent, referer }) {
  return {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    cookie,
    referer,
    "user-agent": userAgent
  };
}

function parseExtraHeaders(value) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, headerValue]) => [String(key).toLowerCase(), String(headerValue)])
    );
  } catch {
    return {};
  }
}

function splitKeywords(value) {
  return String(value || "")
    .split(/[\n,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasHeader(headers, name) {
  const lowerName = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lowerName);
}

function normalizeMethod(value) {
  const method = String(value || "GET").trim().toUpperCase();
  return /^[A-Z]+$/.test(method) ? method : "GET";
}

function pageDiagnostics(page) {
  return {
    url: page.url,
    httpStatus: page.status,
    contentType: page.headers.get("content-type") || "",
    sample: compactText(page.text).slice(0, 320)
  };
}

function result(ok, status, message, extra = {}) {
  return {
    ok,
    status,
    message,
    checkedAt: new Date().toISOString(),
    ...extra
  };
}

function compactText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeSecret(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]?\s*cookie\s*:\s*/i, "")
    .replace(/^-H\s+['"]?\s*cookie\s*:\s*/i, "")
    .replace(/['"]$/g, "")
    .trim();
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function absoluteUrl(value, baseUrl) {
  return new URL(value, `${trimTrailingSlash(baseUrl)}/`).toString();
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}
