/* =============================================================
   ERRORS — one error type for every provider, so the refresh code
   can decide what to do without knowing which platform failed.

   kind:
     "config"      env vars missing or wrong (e.g. no channel ID).
                   Nothing to retry; shown as documented/disabled.
     "auth"        token or key rejected. Keep the last good data,
                   mark the platform "error", tell you to reconnect.
     "rate_limit"  429 / quota exceeded. Serve last good data
                   ("stale"); the next refresh will try again.
     "unavailable" timeouts, 5xx, network. Same as rate_limit.

   message is for logs only (Vercel's function logs). It must never
   contain a token, key or code; the public API never shows it.
   ============================================================= */

export class ProviderError extends Error {
  constructor(kind, message, { cause } = {}) {
    super(message, { cause });
    this.name = "ProviderError";
    this.kind = kind;
  }
}
