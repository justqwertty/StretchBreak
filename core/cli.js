// StretchBreak shared CLI. Zero dependencies. Used by every adapter; each adapter
// tells it where the packs live and may add its own subcommands.
//
//   const cli = require("./cli.js");
//   cli.main(process.argv.slice(2), { packsDir: "/path/to/packs" });
//
// Subcommands:
//   pick   [--wait 60] [--surface x] [--area hips] [--force] [--dry]  → stretch JSON or null
//   show   [same]                                                    → JSON line, ---, card HTML
//   card   <json-file | ->                                           → card HTML for a stretch
//   text   [same as pick]                                            → plain-text rendering
//   today                                                            → one-line summary
//   snooze <minutes>
//   list                                                             → id, area, tier, duration, posture
//   config [get | set key value | reset | path]
//   on | off                                                         → enabled true/false
//
// State lives in $STRETCHBREAK_HOME, else ~/.stretchbreak.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { pick, DEFAULTS } = require(path.join(__dirname, "scheduler.js"));

const HOME = process.env.STRETCHBREAK_HOME || path.join(os.homedir(), ".stretchbreak");
const CONFIG = path.join(HOME, "config.json");
const HISTORY = path.join(HOME, "history.jsonl");
const SNOOZE = path.join(HOME, "snooze");

function ensureHome() { fs.mkdirSync(HOME, { recursive: true }); }
function readJSON(f, fallback) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } }
function loadConfig() { return { ...DEFAULTS, packs: ["default"], verbosity: "steps", ...readJSON(CONFIG, {}) }; }
function saveConfig(c) { ensureHome(); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + "\n"); }
function loadHistory() {
  try { return fs.readFileSync(HISTORY, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
}
function appendHistory(entry) { ensureHome(); fs.appendFileSync(HISTORY, JSON.stringify(entry) + "\n"); }
function snoozedUntil() { const t = Number(fs.existsSync(SNOOZE) ? fs.readFileSync(SNOOZE, "utf8") : 0); return t > Date.now() ? t : 0; }

function resolvePack(ref, packsDir) {
  if (/^[a-z0-9-]+$/.test(ref) && fs.existsSync(path.join(packsDir, ref, "pack.json"))) return path.join(packsDir, ref);
  const p = ref.startsWith("~") ? path.join(os.homedir(), ref.slice(1)) : path.resolve(ref);
  return fs.existsSync(path.join(p, "pack.json")) ? p : null;
}

function loadStretches(cfg, packsDir) {
  const byId = new Map();
  for (const ref of cfg.packs || ["default"]) {
    const dir = resolvePack(ref, packsDir);
    if (!dir) { process.stderr.write(`stretchbreak: pack "${ref}" not found, skipping\n`); continue; }
    const pack = readJSON(path.join(dir, "pack.json"), null);
    if (!pack) continue;
    for (const s of pack.stretches) byId.set(`${pack.name}/${s.id}`, { ...s, id: `${pack.name}/${s.id}` });
  }
  return [...byId.values()];
}

function parseArgs(a) {
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true; o[k] = v; }
    else o._.push(a[i]);
  }
  return o;
}

function doPick(o, packsDir) {
  const cfg = loadConfig();
  const now = Date.now();
  if (!o.force && snoozedUntil()) return null;
  let stretches = loadStretches(cfg, packsDir);
  if (o.area) stretches = stretches.filter((s) => s.area === o.area);
  const input = { waitEstimateS: Number(o.wait || 60), surface: o.surface || "cli", now, stretches, history: loadHistory(), config: cfg };
  if (o.force) input.config = { ...cfg, min_wait_s: 0, max_per_hour: 1e9, min_gap_s: 0, quiet_hours: [] };
  const s = pick(input);
  if (!s) return null;
  if (!o.dry) appendHistory({ ts: now, id: s.id, area: s.area, surface: input.surface, wait_s: input.waitEstimateS });
  return s;
}

function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// HTML card for inline renderers (Cowork). Text-first; uses only CSS variables.
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

// Plain-text rendering for terminals and transcripts. verbosity: cue | steps | full
function text(s, verbosity = "steps") {
  const posture = s.posture === "standing" ? ", stand up" : "";
  const head = `🧘 ${s.name} (${s.area.replace("-", " ")}, ${s.duration_s}s${posture})`;
  if (verbosity === "cue") return `${head}: ${s.cue}`;
  const lines = [head, s.cue, ""];
  (s.steps || []).forEach((st, i) => lines.push(`  ${i + 1}. ${st}`));
  if (verbosity === "full") {
    if (s.feel) lines.push("", `  Feel: ${s.feel}`);
    if (s.avoid) lines.push(`  Avoid: ${s.avoid}`);
  }
  return lines.join("\n");
}

function statusCue(s) { return `🧘 ${s.name} · ${s.cue}`; }

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

function main(argv, { packsDir, extra = {} } = {}) {
  const cmd = argv[0];
  const o = parseArgs(argv.slice(1));
  const out = (s) => process.stdout.write(s + "\n");
  if (extra[cmd]) return extra[cmd](o, { packsDir, doPick, loadConfig, saveConfig, loadStretches, text, statusCue, card, HOME });
  switch (cmd) {
    case "pick": return out(JSON.stringify(doPick(o, packsDir)));
    case "show": { const s = doPick(o, packsDir); return out(s ? JSON.stringify(s) + "\n---\n" + card(s) : "null"); }
    case "text": { const s = doPick(o, packsDir); return out(s ? text(s, o.verbosity || loadConfig().verbosity) : ""); }
    case "card": {
      const src = o._[0] === "-" || !o._[0] ? fs.readFileSync(0, "utf8") : fs.readFileSync(o._[0], "utf8");
      return out(card(JSON.parse(src)));
    }
    case "today": return out(today());
    case "snooze": { const m = Number(o._[0] || 30); ensureHome(); fs.writeFileSync(SNOOZE, String(Date.now() + m * 60e3)); return out(`Snoozed for ${m} minutes.`); }
    case "on": { const c = readJSON(CONFIG, {}); c.enabled = true; saveConfig(c); return out("StretchBreak on."); }
    case "off": { const c = readJSON(CONFIG, {}); c.enabled = false; saveConfig(c); return out("StretchBreak off. Run `stretchbreak on` to re-enable."); }
    case "list": { for (const s of loadStretches(loadConfig(), packsDir)) out(`${s.id}\t${s.area}\t${s.tier}\t${s.duration_s}s\t${s.posture}`); return; }
    case "config": {
      const sub = o._[0] || "get";
      if (sub === "get") return out(JSON.stringify(loadConfig(), null, 2));
      if (sub === "set") { const c = readJSON(CONFIG, {}); setDeep(c, o._[1], parseVal(o._[2])); saveConfig(c); return out(`Set ${o._[1]} = ${JSON.stringify(parseVal(o._[2]))}`); }
      if (sub === "reset") { saveConfig({}); return out("Config reset to defaults."); }
      if (sub === "path") return out(CONFIG);
      return out("usage: config [get|set key value|reset|path]");
    }
    default:
      process.stderr.write(`usage: stretchbreak <pick|show|text|card|today|snooze|on|off|list|config${Object.keys(extra).length ? "|" + Object.keys(extra).join("|") : ""}> [options]\n`);
      process.exit(1);
  }
}

module.exports = { main, doPick, card, text, statusCue, today, loadConfig, saveConfig, loadStretches, HOME };
