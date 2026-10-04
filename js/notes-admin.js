"use strict";

/* =============================================================
   NOTES ADMIN — the private approval page (notes-admin.html).
   Lists every note, pending first, with Approve / Hide / Delete.
   The admin secret goes in an Authorization header, never in the
   URL, and is kept in sessionStorage for this tab only.
   ============================================================= */

(function notesAdmin() {
  const API = "/api/feedback";
  const KEY = "mg-admin-key";
  const form = document.getElementById("admin-key");
  const input = document.getElementById("key");
  const status = document.getElementById("admin-status");
  const list = document.getElementById("admin-list");

  const getKey = () => {
    try {
      return window.sessionStorage.getItem(KEY) || "";
    } catch {
      return input.value;
    }
  };
  const setKey = (value) => {
    try {
      window.sessionStorage.setItem(KEY, value);
    } catch {
      /* ignore: the input still holds it */
    }
  };

  function el(tag, className, textValue) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  async function call(method, body) {
    const response = await fetch(method === "GET" ? `${API}?all=1` : API, {
      method,
      headers: { Authorization: `Bearer ${getKey() || input.value}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("Wrong admin secret.");
    if (!response.ok) throw new Error(`Request failed (${data.error || response.status}).`);
    return data;
  }

  function render(notes) {
    const sorted = [...notes].sort((a, b) => (a.status === b.status ? 0 : a.status === "pending" ? -1 : 1));
    const pending = notes.filter((note) => note.status === "pending").length;
    status.textContent = `${pending} waiting · ${notes.length - pending} public`;

    list.replaceChildren(
      ...sorted.map((note) => {
        const item = el("li", "admin-note");
        item.append(el("p", "admin-message", note.message));
        const meta = el("p", "admin-meta");
        meta.append(
          el("span", `admin-tag is-${note.status}`, note.status),
          document.createTextNode(`${note.name}${note.role ? ` · ${note.role}` : ""} · ${String(note.createdAt).slice(0, 16).replace("T", " ")} UTC`)
        );
        item.append(meta);

        const actions = el("div", "admin-actions");
        const button = (label, action) => {
          const node = el("button", "admin-button", label);
          node.type = "button";
          node.dataset.action = action;
          node.addEventListener("click", async () => {
            if (action === "delete" && !window.confirm("Delete this note for good?")) return;
            node.disabled = true;
            try {
              await call("POST", { action, id: note.id });
              await load();
            } catch (error) {
              status.textContent = error.message;
              node.disabled = false;
            }
          });
          return node;
        };
        if (note.status === "pending") actions.append(button("Approve", "approve"));
        else actions.append(button("Hide", "hide"));
        actions.append(button("Delete", "delete"));
        item.append(actions);
        return item;
      })
    );
    if (!notes.length) status.textContent = "No notes yet.";
  }

  async function load() {
    status.textContent = "Loading…";
    try {
      const data = await call("GET");
      form.hidden = true;
      render(Array.isArray(data.notes) ? data.notes : []);
    } catch (error) {
      status.textContent = error.message;
      form.hidden = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setKey(input.value.trim());
    load();
  });

  if (getKey()) load();
})();
