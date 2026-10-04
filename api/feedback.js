/* =============================================================
   /api/feedback — visitor notes.

   Public
     GET   approved notes (newest first, max 50). Cached 1 minute.
     POST  { name, role, message, website, startedAt }
           -> 202 "waiting for approval". Rules: lib/notes.js.

   Admin (Authorization: Bearer ADMIN_SECRET, used by
   notes-admin.html)
     GET   ?all=1                      every note, including pending
     POST  { action: "approve", id }   make a note public
     POST  { action: "hide", id }      back to pending (unpublish)
     POST  { action: "delete", id }    remove for good

   Nothing a visitor sends is ever returned to other visitors until
   you approve it.
   ============================================================= */

import { isAdmin } from "../lib/auth.js";
import { NOTE_LIMITS, allNotes, deleteNote, publicNotes, saveNote, validateNote } from "../lib/notes.js";
import { KEYS, pipeline, storageConfigured, utcDay } from "../lib/store.js";
import { TWO_DAYS, fromOwnSite, visitorHash } from "../lib/visitor.js";

const MAX_BODY_BYTES = 4096;

function json(body, status, cache = "no-store") {
  return Response.json(body, { status, headers: { "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function moderate(body) {
  const notes = await allNotes();
  const note = notes.find((item) => item.id === body.id);
  if (!note) return json({ error: "not_found" }, 404);

  if (body.action === "delete") {
    await deleteNote(note.id);
    return json({ ok: true, id: note.id, deleted: true }, 200);
  }
  if (body.action === "approve" || body.action === "hide") {
    note.status = body.action === "approve" ? "approved" : "pending";
    note.approvedAt = body.action === "approve" ? new Date().toISOString() : null;
    await saveNote(note);
    return json({ ok: true, note }, 200);
  }
  return json({ error: "unknown_action" }, 400);
}

async function submit(request, body) {
  if (!fromOwnSite(request)) return json({ error: "forbidden" }, 403);

  const result = validateNote(body);
  /* Spam traps answer like a success, so bots learn nothing. */
  if (!result.ok && result.silent) return json({ ok: true, pending: true }, 202);
  if (!result.ok) return json({ error: result.error }, 400);

  /* At most N notes per visitor per day (hashed, see lib/visitor.js). */
  const visitor = await visitorHash(request);
  const rateKey = KEYS.notesRate(utcDay(), visitor);
  const [count] = await pipeline([["INCR", rateKey], ["EXPIRE", rateKey, TWO_DAYS]]);
  if (Number(count) > NOTE_LIMITS.perVisitorPerDay) return json({ error: "rate" }, 429);

  /* Keep the approval queue bounded. */
  const pending = (await allNotes()).filter((note) => note.status === "pending").length;
  if (pending >= NOTE_LIMITS.maxPending) return json({ error: "busy" }, 503);

  await saveNote(result.note);
  console.log(`[feedback] new note ${result.note.id} waiting for approval`);
  return json({ ok: true, pending: true }, 202);
}

export default {
  async fetch(request) {
    if (!storageConfigured()) return json({ error: "unavailable" }, 503);
    const url = new URL(request.url);

    try {
      if (request.method === "GET") {
        if (url.searchParams.get("all") === "1") {
          if (!isAdmin(request)) return json({ error: "unauthorized" }, 401);
          return json({ notes: await allNotes() }, 200);
        }
        return json({ notes: publicNotes(await allNotes()) }, 200, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      }

      if (request.method !== "POST") return json({ error: "method" }, 405);
      const body = await readBody(request);
      if (!body) return json({ error: "invalid" }, 400);

      if (body.action) {
        if (!isAdmin(request)) return json({ error: "unauthorized" }, 401);
        return await moderate(body);
      }
      return await submit(request, body);
    } catch (error) {
      console.error(`[feedback] ${error.message}`);
      return json({ error: "unavailable" }, 503);
    }
  }
};
