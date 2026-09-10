#!/usr/bin/env node
// StretchBreak CLI for the Cowork plugin. Zero dependencies.
//
//   node sb.js pick   [--wait 60] [--surface cowork] [--area hips] [--force] [--dry]
//   node sb.js card   <stretch-json-file | ->        → widget HTML on stdout
//   node sb.js show   [same flags as pick]           → pick + card in one step; prints JSON line then HTML
//   node sb.js today                                 → one-line summary of today's stretches
//   node sb.js config [get | set key value | reset]  → read/write ~/.stretchbreak/config.json
//   node sb.js snooze <minutes>
//   node sb.js list                                  → all loaded stretches (id, area, tier)
//
// Home dir: $STRETCHBREAK_HOME, else ~/.stretchbreak

const fs = require("fs");
const path = require("path");
const os = require("os");
const { pick, DEFAULTS } = require(path.join(__dirname, "..", "vendor", "core", "scheduler.js"));

const HOME = process.env.STRETCHBREAK_HOME || path.join(os.homedir(), ".stretchbreak");
const CONFIG = path.join(HOME, "config.json");
const HISTORY = path.join(HOME, "history.jsonl");
const SNOOZE = path.join(HOME, "snooze");
const VENDOR_PACKS = path.join(__dirname, "..", "vendor", "packs");

function ensureHome() { fs.mkdirSync(HOME, { recursive: true }); }
function readJSON(f, fallback) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } }
function loadConfig() { return { ...DEFAULTS, packs: ["default"], ...readJSON(CONFIG, {}) }; }
function saveConfig(c) { ensureHome(); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + "\n"); }
function loadHistory() {
  try { return fs.readFileSync(HISTORY, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
}
function appendHistory(entry) { ensureHome(); fs.appendFileSync(HISTORY, JSON.stringify(entry) + "\n"); }

function resolvePack(ref) {
  if (/^[a-z0-9-]+$/.test(ref) && fs.existsSync(path.join(VENDOR_PACKS, ref))) return path.join(VENDOR_PACKS, ref);
  const p = ref.startsWith("~") ? path.join(os.homedir(), ref.slice(1)) : path.resolve(ref);
  return fs.existsSync(path.join(p, "pack.json")) ? p : null;
}

function loadStretches(cfg) {
  const byId = new Map();
  for (const ref of cfg.packs || ["default"]) {
    const dir = resolvePack(ref);
    if (!dir) { process.stderr.write(`stretchbreak: pack "${ref}" not found, skipping\n`); continue; }
    const pack = readJSON(path.join(dir, "pack.json"), null);
    if (!pack) continue;
    for (const s of pack.stretches) byId.set(`${pack.name}/${s.id}`, { ...s, id: `${pack.name}/${s.id}`, _dir: dir });
  }
  return [...byId.values()];
}

function args() {
  const a = process.argv.slice(3), o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true; o[k] = v; }
    else o._.push(a[i]);
  }
  return o;
}

function snoozedUntil() { const t = Number(fs.existsSync(SNOOZE) ? fs.readFileSync(SNOOZE, "utf8") : 0); return t > Date.now() ? t : 0; }

function doPick(o) {
  const cfg = loadConfig();
  const now = Date.now();
  if (!o.force && snoozedUntil()) return null;
  let stretches = loadStretches(cfg);
  if (o.area) stretches = stretches.filter((s) => s.area === o.area);
  const history = loadHistory();
  const input = { waitEstimateS: Number(o.wait || 60), surface: o.surface || "cowork", now, stretches, history, config: cfg };
  if (o.force) input.config = { ...cfg, min_wait_s: 0, max_per_hour: 1e9, min_gap_s: 0, quiet_hours: [] };
  const s = pick(input);
  if (!s) return null;
  if (!o.dry) appendHistory({ ts: now, id: s.id, area: s.area, surface: input.surface, wait_s: input.waitEstimateS });
  const out = { ...s };
  delete out._dir;
  return out;
}

function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// Widget HTML for the Cowork inline renderer. Text-first: the instructions are the product.
// Uses only CSS variables so it works in light and dark.
function card(s) {
  const area = s.area.replace("-", " ");
  const steps = (s.steps || []).map((st) => `<li style="margin:0 0 6px">${esc(st)}</li>`).join("");
  const sid = "sb" + Math.random().toString(36).slice(2, 8);
  const posture = s.posture === "standing" ? " · stand up" : "";
  return `<h2 class="sr-only" style="position:absolute;left:-9999px">${esc(s.name)}: ${esc(s.cue)}</h2>
<div style="background:var(--surface-2);border:0.5px solid var(--border);border-radius:12px;padding:1rem 1.25rem;max-width:600px">
  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:2px">Stretch while I work · ${esc(area)} · ${s.duration_s}s${posture}</div>
  <div style="font-size:18px;font-weight:500;margin:0 0 4px">${esc(s.name)}</div>
  <div style="font-size:14px;line-height:1.5;margin:0 0 10px">${esc(s.cue)}</div>
  <ol style="font-size:14px;line-height:1.5;padding-left:20px;margin:0 0 10px">${steps}</ol>
  ${s.feel ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 4px"><span style="font-weight:500">Feel:</span> ${esc(s.feel)}</div>` : ""}
  ${s.avoid ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0 0 10px"><span style="font-weight:500">Avoid:</span> ${esc(s.avoid)}</div>` : ""}
  <div style="display:flex;align-items:center;gap:10px">
    <div style="flex:1;height:4px;background:var(--surface-1);border-radius:2px;overflow:hidden"><div id="${sid}-bar" style="height:100%;width:100%;background:var(--fill-accent);transition:width 1s linear"></div></div>
    <span id="${sid}-t" style="font-size:13px;color:var(--text-secondary);min-width:28px;text-align:right">${s.duration_s}s</span>
  </div>
</div>
<script>
(function(){var d=${s.duration_s},t=d,b=document.getElementById("${sid}-bar"),l=document.getElementById("${sid}-t");
var iv=setInterval(function(){t--;if(t<=0){clearInterval(iv);b.style.width="0%";l.textContent="done";return;}b.style.width=(100*t/d)+"%";l.textContent=t+"s";},1000);})();
</script>`;
}

function today() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const h = loadHistory().filter((e) => e.ts >= start.getTime());
  if (!h.length) return "No stretches yet today.";
  const byArea = {};
  for (const e of h) byArea[e.area] = (byArea[e.area] || 0) + 1;
  const parts = Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a.replace("-", " ")} ${n}`);
  return `Today: ${h.length} stretch${h.length === 1 ? "" : "es"} · ${parts.join(" · ")}`;
}

function setDeep(obj, key, val) {
  const ks = key.split("."); let o = obj;
  for (const k of ks.slice(0, -1)) { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; }
  o[ks[ks.length - 1]] = val;
}
function parseVal(v) { try { return JSON.parse(v); } catch { return v; } }

const cmd = process.argv[2];
const o = args();
switch (cmd) {
  case "pick": { const s = doPick(o); process.stdout.write(JSON.stringify(s) + "\n"); break; }
  case "card": {
    const src = o._[0] === "-" || !o._[0] ? fs.readFileSync(0, "utf8") : fs.readFileSync(o._[0], "utf8");
    process.stdout.write(card(JSON.parse(src)) + "\n"); break;
  }
  case "show": {
    const s = doPick(o);
    if (!s) { process.stdout.write("null\n"); break; }
    process.stdout.write(JSON.stringify(s) + "\n---\n" + card(s) + "\n"); break;
  }
  case "today": process.stdout.write(today() + "\n"); break;
  case "snooze": {
    const m = Number(o._[0] || 30); ensureHome();
    fs.writeFileSync(SNOOZE, String(Date.now() + m * 60e3));
    process.stdout.write(`Snoozed for ${m} minutes.\n`); break;
  }
  case "list": {
    for (const s of loadStretches(loadConfig())) process.stdout.write(`${s.id}\t${s.area}\t${s.tier}\t${s.duration_s}s\t${s.posture}\n`);
    break;
  }
  case "config": {
    const sub = o._[0] || "get";
    if (sub === "get") process.stdout.write(JSON.stringify(loadConfig(), null, 2) + "\n");
    else if (sub === "set") { const c = readJSON(CONFIG, {}); setDeep(c, o._[1], parseVal(o._[2])); saveConfig(c); process.stdout.write(`Set ${o._[1]} = ${JSON.stringify(parseVal(o._[2]))}\n`); }
    else if (sub === "reset") { saveConfig({}); process.stdout.write("Config reset to defaults.\n"); }
    else if (sub === "path") process.stdout.write(CONFIG + "\n");
    break;
  }
  default:
    process.stderr.write("usage: sb.js <pick|card|show|today|snooze|list|config> [options]\n");
    process.exit(1);
}
