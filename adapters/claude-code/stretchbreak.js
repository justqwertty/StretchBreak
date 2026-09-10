#!/usr/bin/env node
// StretchBreak for Claude Code. Zero dependencies.
//
// Adds three commands on top of the shared CLI (core/cli.js):
//   hook        read a Claude Code hook payload on stdin; on PreToolUse/SubagentStart decide
//               whether to show a stretch and write it to the state file; on PostToolUse
//               record how long the tool actually took; on Stop clear the display.
//   statusline  read the status-line payload on stdin; print the previous status line (if
//               one was wrapped at install) plus the current stretch, if any.
//   install     merge hooks + statusLine into ~/.claude/settings.json (backup first)
//   uninstall   remove them again and restore the previous statusLine
//
// Display is text in the status line, layered by config.verbosity: cue | steps | full.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const cli = require(path.join(__dirname, "..", "..", "core", "cli.js"));

const PACKS = path.join(__dirname, "..", "..", "packs");
const HOME = cli.HOME;
const CURRENT = path.join(HOME, "cc-current.json");
const PENDING = path.join(HOME, "cc-pending.json");
const TOOLS = path.join(HOME, "cc-tools.json");
const PREV_STATUS = path.join(HOME, "cc-prev-statusline.json");
const SETTINGS = process.env.CLAUDE_SETTINGS || path.join(os.homedir(), ".claude", "settings.json");
const SELF = path.resolve(__filename);
const MARK = "stretchbreak.js";

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const readStdin = () => { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } };

// ---- wait estimation -------------------------------------------------------
// Seed p50s in seconds. Observed durations replace these via an EMA once seen 3+ times.
const SEED = {
  Read: 2, Glob: 2, Grep: 2, LS: 2, TodoWrite: 2, TaskCreate: 2, TaskUpdate: 2, NotebookRead: 3,
  Edit: 4, Write: 4, MultiEdit: 5, NotebookEdit: 5,
  WebFetch: 12, WebSearch: 10,
  Bash: 20, PowerShell: 20,
  Agent: 150, Task: 150,
};
const DEFAULT_TOOL = 8;

function estimateWait(toolName, effort, stats) {
  const st = stats[toolName];
  let s = st && st.n >= 3 ? st.ema : (SEED[toolName] ?? (toolName && toolName.startsWith("mcp__") ? 10 : DEFAULT_TOOL));
  const lvl = effort && effort.level;
  if (lvl === "high") s *= 1.3;
  if (lvl === "xhigh" || lvl === "max") s *= 1.6;
  return Math.round(s);
}

function recordDuration(toolName, seconds, stats) {
  const st = stats[toolName] || { ema: seconds, n: 0 };
  st.ema = st.n === 0 ? seconds : st.ema * 0.7 + seconds * 0.3;
  st.n += 1;
  stats[toolName] = st;
}

// ---- hook ------------------------------------------------------------------
function hook() {
  let p = null;
  try { p = JSON.parse(readStdin()); } catch {}
  if (!p) return;
  const ev = p.hook_event_name;
  const cfg = cli.loadConfig();
  if (cfg.enabled === false) return;
  const surfaceOff = cfg.surfaces && cfg.surfaces["claude-code"] && cfg.surfaces["claude-code"].enabled === false;
  if (surfaceOff) return;

  if (ev === "PreToolUse" || ev === "SubagentStart") {
    const stats = readJSON(TOOLS, {});
    const wait = ev === "SubagentStart" ? 150 : estimateWait(p.tool_name, p.effort, stats);
    if (ev === "PreToolUse" && p.tool_use_id) {
      const pend = readJSON(PENDING, {});
      pend[p.tool_use_id] = { tool: p.tool_name, ts: Date.now() };
      // keep the map small
      const keys = Object.keys(pend); if (keys.length > 50) for (const k of keys.slice(0, keys.length - 50)) delete pend[k];
      writeJSON(PENDING, pend);
    }
    const cur = readJSON(CURRENT, null);
    if (cur && cur.expires > Date.now()) return; // one at a time
    const s = cli.doPick({ wait, surface: "claude-code" }, PACKS);
    if (!s) return;
    writeJSON(CURRENT, { ts: Date.now(), expires: Date.now() + (s.duration_s + 15) * 1000, session_id: p.session_id, tool_use_id: p.tool_use_id || null, stretch: s });
    return;
  }
  if (ev === "PostToolUse" || ev === "PostToolUseFailure") {
    if (!p.tool_use_id) return;
    const pend = readJSON(PENDING, {});
    const start = pend[p.tool_use_id];
    if (start) {
      const stats = readJSON(TOOLS, {});
      recordDuration(start.tool, (Date.now() - start.ts) / 1000, stats);
      writeJSON(TOOLS, stats);
      delete pend[p.tool_use_id];
      writeJSON(PENDING, pend);
    }
    return;
  }
  if (ev === "Stop" || ev === "SessionEnd") {
    // Claude is ready: clear whatever is showing.
    try { fs.unlinkSync(CURRENT); } catch {}
  }
}

// ---- status line -----------------------------------------------------------
function statusline() {
  const input = readStdin();
  const prev = readJSON(PREV_STATUS, null);
  let lines = [];
  if (prev && prev.command) {
    try { lines.push(execSync(prev.command, { input, encoding: "utf8", timeout: 4000, shell: true }).replace(/\n$/, "")); } catch {}
  }
  const cur = readJSON(CURRENT, null);
  if (cur && cur.expires > Date.now()) {
    const s = cur.stretch;
    const left = Math.max(0, Math.round((cur.ts + s.duration_s * 1000 - Date.now()) / 1000));
    const v = cli.loadConfig().verbosity || "cue";
    lines.push(`${cli.statusCue(s)}${left > 0 ? `  [${left}s]` : ""}`);
    if (v === "steps" || v === "full") (s.steps || []).forEach((st, i) => lines.push(`   ${i + 1}. ${st}`));
    if (v === "full") { if (s.feel) lines.push(`   Feel: ${s.feel}`); if (s.avoid) lines.push(`   Avoid: ${s.avoid}`); }
  }
  process.stdout.write(lines.filter((l) => l !== undefined).join("\n") + (lines.length ? "\n" : ""));
}

// ---- install / uninstall ---------------------------------------------------
const NODE = process.execPath;
const hookCmd = `"${NODE}" "${SELF}" hook`;
const statusCmd = `"${NODE}" "${SELF}" statusline`;

function hookEntry(matcher) {
  const e = { hooks: [{ type: "command", command: hookCmd, async: true, timeout: 10 }] };
  if (matcher) e.matcher = matcher;
  return e;
}

function install() {
  const settings = readJSON(SETTINGS, {});
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-${Date.now()}`);
  settings.hooks = settings.hooks || {};
  for (const ev of ["PreToolUse", "PostToolUse", "PostToolUseFailure", "SubagentStart", "Stop", "SessionEnd"]) {
    const arr = (settings.hooks[ev] || []).filter((e) => !JSON.stringify(e).includes(MARK));
    arr.push(hookEntry(null));
    settings.hooks[ev] = arr;
  }
  if (settings.statusLine && !JSON.stringify(settings.statusLine).includes(MARK)) {
    writeJSON(PREV_STATUS, settings.statusLine);
  }
  settings.statusLine = { type: "command", command: statusCmd, refreshInterval: 2 };
  writeJSON(SETTINGS, settings);
  const c = readJSON(cli.HOME + "/config.json", {});
  if (c.enabled === undefined) { c.enabled = true; writeJSON(cli.HOME + "/config.json", c); }
  console.log(`StretchBreak installed into ${SETTINGS}.
Stretches appear in the status line during longer tool runs. Restart Claude Code to pick up the hooks.
  stretchbreak off | on          turn off / on
  stretchbreak config set verbosity steps   show numbered steps under the cue (cue | steps | full)
  stretchbreak today             what you've done today
  stretchbreak uninstall         remove hooks and restore your previous status line`);
}

function uninstall() {
  const settings = readJSON(SETTINGS, null);
  if (!settings) return console.log("Nothing to uninstall.");
  fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-${Date.now()}`);
  if (settings.hooks) for (const ev of Object.keys(settings.hooks)) {
    settings.hooks[ev] = settings.hooks[ev].filter((e) => !JSON.stringify(e).includes(MARK));
    if (!settings.hooks[ev].length) delete settings.hooks[ev];
  }
  if (settings.statusLine && JSON.stringify(settings.statusLine).includes(MARK)) {
    const prev = readJSON(PREV_STATUS, null);
    if (prev) settings.statusLine = prev; else delete settings.statusLine;
  }
  writeJSON(SETTINGS, settings);
  try { fs.unlinkSync(CURRENT); } catch {}
  console.log("StretchBreak removed from Claude Code settings. Your config and history in ~/.stretchbreak are untouched.");
}

module.exports = { estimateWait, recordDuration, SEED };

if (require.main === module) {
  cli.main(process.argv.slice(2), {
    packsDir: PACKS,
    extra: { hook, statusline, install, uninstall },
  });
}
