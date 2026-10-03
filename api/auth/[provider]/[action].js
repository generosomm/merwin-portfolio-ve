/* =============================================================
   /api/auth/<provider>/<start|callback>

   One function for every platform's connect flow. Vercel's Hobby
   plan allows 12 functions per deployment; a file per platform per
   step would spend 6 of them on links you click once a year. The
   URLs are the same either way (e.g. /api/auth/tiktok/callback,
   which is what's registered with TikTok). Logic: lib/oauth.js.
   ============================================================= */

import { handleOAuth } from "../../../lib/oauth.js";

export default {
  fetch: (request) => handleOAuth(request)
};
