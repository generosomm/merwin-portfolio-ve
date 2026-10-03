/* =============================================================
   HTTP — the one fetch wrapper every provider uses.

   - 10 s timeout per attempt (AbortSignal.timeout).
   - Up to 2 retries on 429, 5xx, timeouts and network errors,
     with exponential backoff plus jitter: ~0.5 s, then ~1 s.
     A Retry-After header is honoured, capped so a refresh never
     stalls for minutes.
   - No retry on other 4xx: a rejected token or a bad request will
     fail the same way again, and retrying auth errors can get an
     app rate-limited or flagged.
   - URLs are redacted before they reach a log or an error message,
     because several APIs put keys and tokens in the query string.
   ============================================================= */

/* Mutable so tests can shrink the waits; production uses these. */
export const httpDefaults = {
  timeoutMs: 10_000,
  retries: 2,
  backoffBaseMs: 500,
  maxRetryAfterMs: 5_000
};

const SECRET_PARAMS = /([?&](?:key|access_token|refresh_token|client_secret|client_key|code|code_verifier|fb_exchange_token)=)[^&#]*/gi;

export function redact(url) {
  return String(url).replace(SECRET_PARAMS, "$1***");
}

export class HttpError extends Error {
  constructor(message, { status = 0, reason = "", auth = false, retryable = false, body = null } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status; // 0 = no response (timeout or network)
    this.reason = reason; // the API's own error code, when it gives one
    this.auth = auth; // true = credentials rejected
    this.retryable = retryable;
    this.body = body; // parsed error body, for the provider to inspect
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function backoff(attempt, retryAfterHeader) {
  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, httpDefaults.maxRetryAfterMs);
  }
  const base = httpDefaults.backoffBaseMs * 2 ** attempt;
  return base + Math.random() * base * 0.5;
}

/* Default reading of an HTTP status. Providers can pass their own
   classify() when an API bends the rules (YouTube answers 403 for
   both "bad key" and "quota exceeded", for example). */
function defaultClassify(status) {
  return {
    auth: status === 401 || status === 403,
    retryable: status === 429 || status >= 500,
    reason: ""
  };
}

/**
 * Fetch JSON with timeout, retries and safe error messages.
 * @param {string} url
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.headers]
 * @param {object|string|URLSearchParams} [options.body]  plain objects are sent as JSON
 * @param {string} [options.label]  provider name for logs, e.g. "youtube"
 * @param {(status:number, body:any) => {auth?:boolean, retryable?:boolean, reason?:string}} [options.classify]
 */
export async function requestJSON(url, options = {}) {
  const { method = "GET", headers = {}, body, label = "http", classify } = options;
  const retries = options.retries ?? httpDefaults.retries;
  const timeoutMs = options.timeoutMs ?? httpDefaults.timeoutMs;

  const init = { method, headers: { Accept: "application/json", ...headers } };
  if (body !== undefined) {
    const isPlainObject = body && typeof body === "object" && !(body instanceof URLSearchParams);
    init.body = isPlainObject ? JSON.stringify(body) : body;
    if (isPlainObject) init.headers["Content-Type"] = "application/json";
  }

  const safeUrl = redact(url);

  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      if (attempt < retries) {
        const wait = backoff(attempt);
        console.warn(`[${label}] ${timedOut ? "timeout" : "network error"} on ${method} ${safeUrl}; retry ${attempt + 1} in ${Math.round(wait)} ms`);
        await sleep(wait);
        continue;
      }
      throw new HttpError(`${label}: ${timedOut ? `no response within ${timeoutMs} ms` : "network error"} (${method} ${safeUrl})`, {
        reason: timedOut ? "timeout" : "network",
        retryable: true
      });
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null; // non-JSON body (an HTML error page, say)
    }

    if (response.ok) return data;

    const verdict = { ...defaultClassify(response.status), ...(classify?.(response.status, data) || {}) };
    if (verdict.retryable && attempt < retries) {
      const wait = backoff(attempt, response.headers.get("retry-after"));
      console.warn(`[${label}] HTTP ${response.status}${verdict.reason ? ` ${verdict.reason}` : ""} on ${method} ${safeUrl}; retry ${attempt + 1} in ${Math.round(wait)} ms`);
      await sleep(wait);
      continue;
    }

    throw new HttpError(`${label}: HTTP ${response.status}${verdict.reason ? ` (${verdict.reason})` : ""} on ${method} ${safeUrl}`, {
      status: response.status,
      reason: verdict.reason,
      auth: Boolean(verdict.auth),
      retryable: Boolean(verdict.retryable),
      body: data
    });
  }
}
