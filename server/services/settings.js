const prisma = require("../prisma/client");

/* =============================================================================
   Runtime platform settings.

   Read on nearly every peer-verification request, so values are cached in
   memory for a short TTL rather than hitting the database each time. The cache
   is invalidated immediately on write, so an admin's change takes effect on the
   next request — not 30 seconds later.
   ========================================================================== */

const CACHE_TTL_MS = 30_000;
const cache = new Map(); // key -> { value, expires }

const DEFAULTS = {
  peer_max_students: "1",
};

const DESCRIPTIONS = {
  peer_max_students:
    "How many DISTINCT students one student may evaluate as a peer. Use 0 to disable peer review, or -1 for unlimited.",
};

async function getSetting(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  let value = DEFAULTS[key] ?? null;
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    if (row) value = row.value;
  } catch {
    // Table missing (migration not yet applied) — fall back to the default
    // rather than failing the request.
  }

  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Peer cap as a number. null means unlimited. */
async function getPeerMaxStudents() {
  const raw = await getSetting("peer_max_students");
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 1;
  if (n < 0) return null; // -1 => unlimited
  return n;
}

async function setSetting(key, value, updatedBy) {
  const row = await prisma.platformSetting.upsert({
    where: { key },
    update: { value: String(value), updatedBy: updatedBy || null },
    create: {
      key,
      value: String(value),
      description: DESCRIPTIONS[key] || null,
      updatedBy: updatedBy || null,
    },
  });
  cache.delete(key); // take effect immediately
  return row;
}

async function getAllSettings() {
  let rows = [];
  try {
    rows = await prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
  } catch {
    rows = [];
  }
  // Surface defaults for any key not yet persisted, so the admin UI always has
  // something to render.
  const present = new Set(rows.map((r) => r.key));
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!present.has(key)) {
      rows.push({ key, value, description: DESCRIPTIONS[key] || null, updatedBy: null, updatedAt: null });
    }
  }
  return rows;
}

module.exports = { getSetting, setSetting, getAllSettings, getPeerMaxStudents, DESCRIPTIONS };
