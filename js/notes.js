"use strict";

/* =============================================================
   NOTES — the Visitor Notes section: shows approved notes from
   /api/feedback and sends new ones for approval.

   - The section shell (title, intro, hidden list and form) comes
     from js/content.js and data/notes.json.
   - The list and form only appear once the API answers, so a
     visitor never gets a form that can't send.
   - Notes are text from strangers: they're only ever set with
     textContent, never innerHTML.
   ============================================================= */

(function notes() {
  const API = "/api/feedback";

  const fill = (template, values) =>
    String(template || "").replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : ""));

  const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  function el(tag, className, textValue) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  async function getJSON(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function renderList(listNode, emptyNode, items) {
    const notes = Array.isArray(items) ? items : [];
    listNode.replaceChildren(
      ...notes.map((note) => {
        const item = el("li", "note");
        const quote = el("blockquote", "note-message", note.message);
        const meta = el("p", "note-meta");
        meta.append(el("span", "note-name", note.name));
        if (note.role) meta.append(el("span", "note-role", note.role));
        const date = new Date(`${note.date}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) {
          const time = el("time", "note-date", dateFormat.format(date));
          time.dateTime = note.date;
          meta.append(time);
        }
        item.append(quote, meta);
        return item;
      })
    );
    emptyNode.hidden = notes.length > 0;
  }

  function wireForm(form, copy) {
    const status = form.querySelector("[data-notes-status]");
    const counter = form.querySelector("[data-notes-counter]");
    const message = form.elements.message;
    const button = form.querySelector('button[type="submit"]');
    const errors = copy.errors || {};

    /* When the form was first seen: the server ignores notes sent
       less than 3 s later (bots fill forms instantly). */
    let startedAt = Date.now();

    const updateCounter = () => {
      if (!counter || !message) return;
      counter.textContent = fill(copy.counter, { n: message.value.length, max: message.maxLength });
    };
    message?.addEventListener("input", updateCounter);
    updateCounter();

    const setStatus = (textValue, state) => {
      status.textContent = textValue;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      /* The browser's own checks first (lengths, required). */
      if (!form.checkValidity()) {
        const firstInvalid = form.querySelector(":invalid");
        const key = firstInvalid?.name === "message" ? "message" : firstInvalid?.name === "role" ? "role" : "name";
        setStatus(errors[key] || errors.default, "error");
        firstInvalid?.focus();
        return;
      }

      button.disabled = true;
      setStatus(copy.sending);
      try {
        const { ok, body } = await getJSON(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.elements.name.value,
            role: form.elements.role.value,
            message: form.elements.message.value,
            website: form.elements.website.value,
            startedAt
          })
        }, 10000);
        if (ok) {
          form.reset();
          updateCounter();
          startedAt = Date.now();
          setStatus(copy.sent, "ok");
        } else {
          setStatus(errors[body?.error] || errors.default, "error");
        }
      } catch {
        setStatus(errors.default, "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  async function start() {
    const payload = await window.portfolioContentReady?.catch(() => null);
    const copy = payload?.data?.notes;
    const section = document.querySelector('[data-section="notes"]');
    const block = section?.querySelector("[data-notes]");
    const listNode = section?.querySelector("[data-notes-list]");
    const emptyNode = section?.querySelector("[data-notes-empty]");
    const form = section?.querySelector("[data-notes-form]");
    if (!copy || !block || !listNode || !emptyNode || !form) return;

    try {
      const { ok, body } = await getJSON(API);
      if (!ok) throw new Error("unavailable");
      renderList(listNode, emptyNode, body.notes);
      block.hidden = false;
      (form.closest("[data-notes-fold]") || form).hidden = false; // the 3D key + folded form
      wireForm(form, copy.form || {});
    } catch (error) {
      /* No API (local preview, or it's down): leave the intro only. */
      console.info(`[notes] not shown (${error.message}).`);
    }
  }

  start();
})();
