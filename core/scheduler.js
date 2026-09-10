// StretchBreak scheduler — a pure function, no I/O. See docs/SPEC.md §3.
//
//   pick({ waitEstimateS, surface, now, config, stretches, history, random }) → stretch | null
//
// `stretches` is the merged, namespaced list from all packs (ids like "default/chin-tuck").
// `history` is an array of { ts, id, area, surface } newest-last. `now` is epoch ms.
// Adapters own the I/O (reading config/history, writing the pick back).

const TIER_ORDER = ["micro", "short", "medium", "long"];

const DEFAULTS = {
  enabled: true,
  min_wait_s: 8,
  max_per_hour: 6,
  min_gap_s: 240,
  areas: {},            // area → boolean; missing = true
  exclude_tags: [],
  posture: "either",    // "seated" | "either"
  quiet_hours: [],      // [["22:00","08:00"], ...]
  overrides: {},        // id → { enabled?, duration_s? }
  surfaces: {},
  eye_bonus_every_s: 20 * 60,
};

function tierForWait(waitS, cfg) {
  if (waitS < cfg.min_wait_s) return null;
  if (waitS < 20) return "micro";
  if (waitS < 45) return "short";
  if (waitS < 120) return "medium";
  return "long";
}

function inQuietHours(now, ranges) {
  if (!ranges || ranges.length === 0) return false;
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  const toMins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  return ranges.some(([a, b]) => {
    const s = toMins(a), e = toMins(b);
    return s <= e ? mins >= s && mins < e : mins >= s || mins < e; // wraps midnight
  });
}

function pick(input) {
  const cfg = { ...DEFAULTS, ...(input.config || {}) };
  const now = input.now ?? Date.now();
  const history = input.history || [];
  const random = input.random || Math.random;
  const surface = input.surface || "unknown";

  // 1. Gate
  if (!cfg.enabled) return null;
  if (cfg.surfaces[surface] && cfg.surfaces[surface].enabled === false) return null;
  if (inQuietHours(now, cfg.quiet_hours)) return null;
  const lastHour = history.filter((h) => now - h.ts < 3600e3);
  if (lastHour.length >= cfg.max_per_hour) return null;
  const last = history[history.length - 1];
  if (last && now - last.ts < cfg.min_gap_s * 1e3) return null;

  // 2. Tier
  const tier = tierForWait(input.waitEstimateS, cfg);
  if (!tier) return null;
  const maxIdx = TIER_ORDER.indexOf(tier);
  const allowedTiers = new Set(TIER_ORDER.slice(Math.max(0, maxIdx - 1), maxIdx + 1));

  // 3. Filter
  const excluded = new Set(cfg.exclude_tags);
  const candidates = (input.stretches || []).map((s) => {
    const o = cfg.overrides[s.id] || cfg.overrides[s.id.split("/").pop()] || {};
    return { ...s, ...o };
  }).filter((s) => {
    if (s.enabled === false) return false;
    if (!allowedTiers.has(s.tier)) return false;
    if (cfg.areas[s.area] === false) return false;
    if (s.contra.some((c) => excluded.has(c))) return false;
    if (cfg.posture === "seated" && s.posture === "standing") return false;
    if (tier === "micro" && !s.hands_free) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  // 4. Rotation score
  const lastByArea = {};
  for (const h of history) lastByArea[h.area] = Math.max(lastByArea[h.area] || 0, h.ts);
  const recentIds = new Set(history.slice(-3).map((h) => h.id));
  const lastEyes = lastByArea.eyes || 0;

  let best = null, bestScore = -Infinity;
  for (const s of candidates) {
    const hoursSinceArea = (now - (lastByArea[s.area] || 0)) / 3600e3;
    let score = Math.min(hoursSinceArea, 24);          // cap so a never-seen area isn't infinitely sticky
    if (recentIds.has(s.id)) score -= 5;                // avoid the same stretch 3 picks in a row
    if (s.area === "eyes" && now - lastEyes >= cfg.eye_bonus_every_s * 1e3) score += 2; // ~20-20-20
    if (s.tier === tier) score += 0.5;                  // slight preference for the exact tier
    score += random() * 0.25;                           // jitter
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

module.exports = { pick, tierForWait, inQuietHours, DEFAULTS };
