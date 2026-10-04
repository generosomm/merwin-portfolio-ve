"use strict";

/* =============================================================
   VISITS — the public visit counter in the footer
   ("1,284 visits since Oct 2026").

   A visit is counted once per browser per day, and only after the
   page has been open and visible for 3 seconds (bounces and most
   bots don't count). The server double-checks with a salted,
   daily-changing hash, see api/visit.js. The browser remembers
   only the date it last counted, in localStorage, to avoid asking
   again the same day.
   ============================================================= */

(function visits() {
  const API = "/api/visit";
  const STORAGE_KEY = "mg-visit-day";
  const DWELL_MS = 3000;
  const today = new Date().toISOString().slice(0, 10);
  const monthFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

  const readDay = () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };
  const writeDay = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, today);
    } catch {
      /* private mode: the server's own daily check still applies */
    }
  };

  function show(data) {
    const node = document.querySelector("[data-visits]");
    const total = Number(data?.total);
    if (!node || !Number.isFinite(total) || total < 1 || !data.since) return;
    const since = monthFormat.format(new Date(`${data.since}T00:00:00Z`));
    node.textContent = String(node.dataset.template || "")
      .replace("{n}", total.toLocaleString("en"))
      .replace("{since}", since);
    node.hidden = false;
  }

  async function request(method) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(API, { method, signal: controller.signal, headers: method === "POST" ? { "Content-Type": "application/json" } : {} });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /* Resolves once the page has been visible for DWELL_MS in a row. */
  function dwell() {
    return new Promise((resolve) => {
      let timer = 0;
      const arm = () => {
        window.clearTimeout(timer);
        if (document.visibilityState === "visible") timer = window.setTimeout(done, DWELL_MS);
      };
      const done = () => {
        document.removeEventListener("visibilitychange", arm);
        resolve();
      };
      document.addEventListener("visibilitychange", arm);
      arm();
    });
  }

  async function start() {
    await window.portfolioContentReady?.catch(() => null);
    if (readDay() === today) {
      show(await request("GET"));
      return;
    }
    await dwell();
    const data = await request("POST");
    if (data) {
      writeDay();
      show(data);
    }
  }

  start();
})();
