import { json, isAuthed, rowToStorySlide, groupIntoRings , deleteUploadedImage } from "../../_shared/util.js";

/* /api/admin/stories
   GET  -> every ring (editorial + compare), for the admin Stories tab.
   POST -> one action per call: createRing, addSlide, updateSlide,
           deleteSlide, updateRing, deleteRing, reorderSlides.
   Kept as a single action-routed endpoint (same pattern as orders'
   confirm/cancel) instead of a sprawl of dynamic route files. */

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({
      productId: String(t.productId || "").trim(),
      x: Math.max(2, Math.min(98, Math.round(Number(t.x)))),
      y: Math.max(2, Math.min(98, Math.round(Number(t.y)))),
    }))
    .filter((t) => t.productId && Number.isFinite(t.x) && Number.isFinite(t.y))
    .slice(0, 8); // a story slide with more than 8 hotspots stops being readable
}

function slidePayload(s = {}) {
  return {
    image: String(s.image || "").trim(),
    imageB: String(s.imageB || "").trim(),
    labelA: String(s.labelA || "").trim().slice(0, 30),
    labelB: String(s.labelB || "").trim().slice(0, 30),
    caption: String(s.caption || "").trim().slice(0, 200),
    ctaCategory: String(s.ctaCategory || "").trim(),
    ctaSubcategory: String(s.ctaSubcategory || "").trim(),
    tags: JSON.stringify(cleanTags(s.tags)),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);

  const { results } = await env.DB.prepare(
    "SELECT * FROM stories ORDER BY created_at ASC, sort_order ASC"
  ).all();
  const slides = (results || []).map(rowToStorySlide);
  return json({ rings: groupIntoRings(slides) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) return json({ error: "unauthorized" }, 401);
  if (!env.DB) return json({ error: "Database not configured." }, 500);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = String(body.action || "");
  const now = Date.now();

  // ---------- create a new ring, with its first slide ----------
  if (action === "createRing") {
    const ringTitle = String(body.ringTitle || "").trim().slice(0, 60) || "The Edit";
    const ringType = body.ringType === "compare" ? "compare" : "editorial";
    const pinned = body.pinned !== false;
    const expiresAt = !pinned && body.expiresInHours ? now + Number(body.expiresInHours) * 3600 * 1000 : null;
    const ringId = newId("ring");
    const p = slidePayload(body.slide);

    if (!p.image) return json({ error: "A photo is required." }, 400);
    if (ringType === "compare" && !p.imageB) return json({ error: "The comparison needs a second photo." }, 400);

    await env.DB.prepare(
      `INSERT INTO stories (id, ring_id, ring_title, ring_type, pinned, expires_at, sort_order,
         image, image_b, label_a, label_b, cta_category, cta_subcategory, caption, tags, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`
    ).bind(
      newId("slide"), ringId, ringTitle, ringType, pinned ? 1 : 0, expiresAt, 0,
      p.image, p.imageB, p.labelA, p.labelB, p.ctaCategory, p.ctaSubcategory, p.caption, p.tags, now
    ).run();

    return json({ ok: true, ringId });
  }

  // ---------- add another slide to an existing ring ----------
  if (action === "addSlide") {
    const ringId = String(body.ringId || "");
    const existing = await env.DB.prepare("SELECT * FROM stories WHERE ring_id = ? ORDER BY sort_order DESC LIMIT 1").bind(ringId).first();
    if (!existing) return json({ error: "Ring not found." }, 404);

    const p = slidePayload(body.slide);
    if (!p.image) return json({ error: "A photo is required." }, 400);
    if (existing.ring_type === "compare" && !p.imageB) return json({ error: "The comparison needs a second photo." }, 400);

    await env.DB.prepare(
      `INSERT INTO stories (id, ring_id, ring_title, ring_type, pinned, expires_at, sort_order,
         image, image_b, label_a, label_b, cta_category, cta_subcategory, caption, tags, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`
    ).bind(
      newId("slide"), ringId, existing.ring_title, existing.ring_type, existing.pinned, existing.expires_at,
      (Number(existing.sort_order) || 0) + 1, p.image, p.imageB, p.labelA, p.labelB, p.ctaCategory, p.ctaSubcategory, p.caption, p.tags, now
    ).run();

    return json({ ok: true });
  }

  // ---------- edit one slide ----------
  if (action === "updateSlide") {
    const id = String(body.id || "");
    const row = await env.DB.prepare("SELECT * FROM stories WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "Slide not found." }, 404);
    const p = slidePayload({ ...row, image: row.image, imageB: row.image_b, labelA: row.label_a, labelB: row.label_b, ctaCategory: row.cta_category, ctaSubcategory: row.cta_subcategory, caption: row.caption, tags: JSON.parse(row.tags || "[]"), ...body.patch });

    await env.DB.prepare(
      `UPDATE stories SET image=?, image_b=?, label_a=?, label_b=?, cta_category=?, cta_subcategory=?, caption=?, tags=? WHERE id=?`
    ).bind(p.image, p.imageB, p.labelA, p.labelB, p.ctaCategory, p.ctaSubcategory, p.caption, p.tags, id).run();

    return json({ ok: true });
  }

  // ---------- delete one slide (and clean up its R2 photos) ----------
  if (action === "deleteSlide") {
    const id = String(body.id || "");
    const row = await env.DB.prepare("SELECT * FROM stories WHERE id = ?").bind(id).first();
    if (!row) return json({ error: "Slide not found." }, 404);

    if (env.BUCKET) {
      for (const url of [row.image, row.image_b]) {
        await deleteUploadedImage(env, url);
      }
    }
    await env.DB.prepare("DELETE FROM stories WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // ---------- edit ring-level settings (applies to every slide in it) ----------
  if (action === "updateRing") {
    const ringId = String(body.ringId || "");
    const hit = await env.DB.prepare("SELECT id FROM stories WHERE ring_id = ? LIMIT 1").bind(ringId).first();
    if (!hit) return json({ error: "Ring not found." }, 404);

    const ringTitle = String(body.ringTitle || "").trim().slice(0, 60) || "The Edit";
    const pinned = body.pinned !== false;
    const expiresAt = !pinned && body.expiresInHours ? now + Number(body.expiresInHours) * 3600 * 1000 : null;

    await env.DB.prepare("UPDATE stories SET ring_title=?, pinned=?, expires_at=? WHERE ring_id=?")
      .bind(ringTitle, pinned ? 1 : 0, expiresAt, ringId).run();
    return json({ ok: true });
  }

  // ---------- delete a whole ring ----------
  if (action === "deleteRing") {
    const ringId = String(body.ringId || "");
    const { results } = await env.DB.prepare("SELECT image, image_b FROM stories WHERE ring_id = ?").bind(ringId).all();
    if (env.BUCKET) {
      for (const row of results || []) {
        for (const url of [row.image, row.image_b]) {
          await deleteUploadedImage(env, url);
        }
      }
    }
    await env.DB.prepare("DELETE FROM stories WHERE ring_id = ?").bind(ringId).run();
    return json({ ok: true });
  }

  // ---------- reorder slides within a ring ----------
  if (action === "reorderSlides") {
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
    for (let i = 0; i < orderedIds.length; i++) {
      await env.DB.prepare("UPDATE stories SET sort_order = ? WHERE id = ?").bind(i, String(orderedIds[i])).run();
    }
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
}
