/* =============================================================
   NOTES — visitor notes: validation, spam checks and storage.

   The rules, in one place:
   - Nothing is public until approved (status "pending" -> "approved").
   - Fields: name (2-60), optional role (<= 80), message (10-500).
     Plain text only: control characters stripped, whitespace
     collapsed. The page renders them with textContent anyway.
   - No links. Links are what spam is for; a note doesn't need one.
   - A hidden "website" field (invisible to people, filled in by
     bots) and a minimum of 3 s between the form appearing and being
     sent (bots submit instantly) quietly discard spam: the sender
     sees "thanks" and nothing is stored, so bots learn nothing.
   - At most 3 notes per visitor per day, and at most 100 waiting
     for approval at once, so nobody can fill the database.
   ============================================================= */

import { randomBytes } from "node:crypto";
import { KEYS, command } from "./store.js";

export const NOTE_LIMITS = Object.freeze({
  name: [2, 60],
  role: [0, 80],
  message: [10, 500],
  perVisitorPerDay: 3,
  maxPending: 100,
  minFillMs: 3000,
  publicCount: 50
});

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|dev|xyz|ru|cn|ly|me|info|biz|top|site|online|link)\b)/i;

/** Plain, single-line-ish text: no control characters, collapsed spaces. */
export function cleanText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "") // controls, zero-width, direction overrides
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check a submission.
 * @returns {{ ok: true, note: object } | { ok: false, error: string, silent?: boolean }}
 *   error is a short code the page turns into a message; silent means
 *   "pretend it worked" (spam traps).
 */
export function validateNote(body, now = Date.now()) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid" };

  /* Spam traps first, silently. */
  if (cleanText(body.website)) return { ok: false, error: "spam", silent: true };
  const startedAt = Number(body.startedAt);
  if (!Number.isFinite(startedAt) || now - startedAt < NOTE_LIMITS.minFillMs || now - startedAt > 86_400_000) {
    return { ok: false, error: "spam", silent: true };
  }

  const name = cleanText(body.name);
  const role = cleanText(body.role);
  const message = cleanText(body.message);

  const within = (text, [min, max]) => text.length >= min && text.length <= max;
  if (!within(name, NOTE_LIMITS.name)) return { ok: false, error: "name" };
  if (!within(role, NOTE_LIMITS.role)) return { ok: false, error: "role" };
  if (!within(message, NOTE_LIMITS.message)) return { ok: false, error: "message" };
  if (LINK.test(name) || LINK.test(role) || LINK.test(message)) return { ok: false, error: "links" };

  return {
    ok: true,
    note: {
      id: randomBytes(9).toString("base64url"),
      name,
      role,
      message,
      createdAt: new Date(now).toISOString(),
      status: "pending",
      approvedAt: null
    }
  };
}

/* ---- Storage: one Redis hash, note id -> JSON ------------------- */

export async function allNotes() {
  const flat = (await command("HGETALL", KEYS.notes)) || [];
  const notes = [];
  /* Upstash returns HGETALL as [field, value, field, value, ...]. */
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      notes.push(JSON.parse(flat[i + 1]));
    } catch {
      /* skip a corrupt entry */
    }
  }
  return notes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveNote(note) {
  await command("HSET", KEYS.notes, note.id, JSON.stringify(note));
}

export async function deleteNote(id) {
  return Number(await command("HDEL", KEYS.notes, id)) === 1;
}

/** What the public sees: approved notes only, newest first, no internal fields. */
export function publicNotes(notes) {
  return notes
    .filter((note) => note.status === "approved")
    .slice(0, NOTE_LIMITS.publicCount)
    .map((note) => ({
      id: note.id,
      name: note.name,
      role: note.role || "",
      message: note.message,
      date: String(note.approvedAt || note.createdAt).slice(0, 10)
    }));
}
