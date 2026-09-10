# StretchBreak — Product Spec v0.1

*Working title. Turns AI "thinking" time in Claude Code and Cowork into short, ergonomic micro-stretches.*

---

## 1. Concept

Every time Claude Code or Cowork runs a long tool call or agentic loop, the user sits watching a spinner. That wait is dead attention today. StretchBreak fills it with a 10–60 second movement that targets the specific problems desk work causes: forward-head neck strain, rounded shoulders and tight pecs, forearm and wrist overuse, shortened hip flexors from sitting, and screen-induced eye strain.

The core inversion versus ad-in-the-spinner products: the interruption is the *benefit*. A stretch is exactly the kind of thing that should be short, frequent, and unplanned, which is precisely the shape of AI wait time. The user never has to remember to take a break; the tool's own rhythm becomes the reminder.

Design principles that everything else follows from:

1. **Never cost the user time.** A stretch is only shown when Claude is already busy. It never blocks, never requires completion, and disappears the moment Claude is ready.
2. **Right-sized to the wait.** A 3-second file read gets nothing. A 20-second build gets a chin tuck. A 2-minute agentic run gets a stand-up hip flexor stretch.
3. **Cover the body across a day, not per prompt.** The scheduler rotates through target areas so an afternoon of coding hits neck, shoulders, wrists, hips, and eyes, rather than showing the same neck roll ten times.
4. **User owns the experience.** Opt out of areas (injuries), set intensity (seated-only vs. willing to stand), quiet hours, and frequency caps. Bring your own stretches from a physio.
5. **Instructions are the product.** No pictures, no animations. Every stretch is written precisely enough to follow from the screen: where to put your body, which direction to move, how long, what it should feel like, and what to avoid. Text is universal (terminal, chat, screen reader, any language), packs stay plain JSON anyone can write, and the quality bar is enforced by the validator rather than an asset pipeline.
6. **Same brain, two faces.** One shared core (library + scheduler + config) with a thin adapter per surface. Preferences follow the user across Claude Code and Cowork.
7. **Open by default.** MIT-licensed code, CC BY 4.0 stretch text, and a pack format anyone can publish to. The default library is just the first pack. Every piece (scheduler, packs, adapters) is useful on its own, so people can take only the part they like.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     StretchBreak Core                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Stretch      │  │ Scheduler    │  │ Config +       │  │
│  │ Library      │─▶│ (what/when)  │◀─│ History store  │  │
│  │ (JSON)       │  │              │  │ (~/.stretchbreak)│ │
│  └──────────────┘  └──────┬───────┘  └────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │  pick(waitEstimate) → Stretch | null
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ Claude Code adapter   │       │ Cowork adapter        │
│ • hooks (Pre/PostTool,│       │ • plugin + 3 skills   │
│   Stop, SubagentStart)│       │ • inline text card    │
│ • status line cue     │       │   with countdown      │
│ • steps in transcript │       │ • same config file    │
└───────────────────────┘       └───────────────────────┘
```

The core is a small CLI (`stretchbreak`) written in a language with zero runtime dependencies for the CC path (Go or a single-file Node script are both fine; Node is the pragmatic choice since Claude Code users already have it). Adapters call `stretchbreak pick --wait 25` and get back JSON describing what to show, or nothing.

### 2.1 Stretch record

```jsonc
{
  "id": "neck-side-bend",
  "name": "Neck side bend",
  "area": "neck",                 // neck | shoulders | upper-back | wrists | hands | hips | lower-back | eyes | full-body
  "posture": "either",            // seated | standing | either
  "duration_s": 30,               // total time incl. both sides / all reps
  "tier": "short",                // micro (≤10s) | short (11–30s) | medium (31–59s) | long (≥60s)
  "cue": "Drop your right ear toward your right shoulder, keeping the left shoulder down. 15 seconds, then switch.",
  "steps": [                      // required: precise, ordered, followable without a picture
    "Sit tall. Let both shoulders hang low and relaxed.",
    "Tilt your head to the right, bringing the right ear toward the right shoulder. Don't lift the shoulder to meet it.",
    "Hold for a slow count of fifteen, breathing normally, then return to centre.",
    "Repeat on the left side."
  ],
  "feel": "A long pull down the side of the neck into the top of the opposite shoulder.",   // required in the default pack
  "avoid": "Don't pull the head with your hand; keep your nose pointing forward. Stop if you feel pinching.", // required in the default pack
  "counter": "upper-trap-shortening", // what desk habit it counteracts (used for rotation + copy)
  "hands_free": true,             // can be done without letting go of mouse/keyboard? (false = needs both hands)
  "contra": ["neck-injury"],      // contraindication tags matched against user's exclusions
  "media": { "url": "https://…" } // optional reference link only; never required
}
```

The three text layers serve three moments: `cue` is the one line you can act on from the status line; `steps` are what you read when you have a few seconds; `feel` and `avoid` are the coaching a physio would give standing next to you. Writing guidance is in `docs/PACKS.md`.

`tier` is derived from `duration_s` but stored explicitly so custom stretches can override (e.g. a user wants a 20s stretch treated as "short").

### 2.2 Config schema (`~/.stretchbreak/config.json`)

```jsonc
{
  "enabled": true,
  "min_wait_s": 8,                 // ignore waits shorter than this
  "max_per_hour": 6,               // frequency cap across both surfaces
  "min_gap_s": 240,                // never two stretches closer than this
  "areas": {                       // per-area on/off; default all on
    "neck": true, "shoulders": true, "upper-back": true,
    "wrists": true, "hands": true, "hips": true,
    "lower-back": true, "eyes": true, "full-body": true
  },
  "exclude_tags": [],              // e.g. ["neck-injury", "wrist-injury", "pregnancy"]
  "posture": "either",             // seated | either  (seated = never ask user to stand)
  "quiet_hours": [["22:00", "08:00"]],
  "verbosity": "steps",            // cue (one line) | steps (cue + steps) | full (adds feel/avoid)
  "surfaces": {
    "claude-code": { "enabled": true, "status_line": true },
    "cowork":      { "enabled": true }
  },
  "packs": ["default"],            // installed packs, in priority order (see §2.3). Local paths and github: refs allowed.
  "overrides": {                   // per-stretch tweaks without forking a pack
    "neck-side-bend": { "enabled": false },
    "chin-tuck": { "duration_s": 30 }
  },
  "telemetry": "local"             // local | off  (history for rotation; never leaves the machine)
}
```

Everything has a sensible default; a fresh install works with an empty config.

### 2.3 Stretch packs

A **pack** is a folder (or git repo) containing a single `pack.json`:

```
my-pack/
└── pack.json          # metadata + stretches array (same record format as §2.1)
```

That's the whole format. No assets, no build step; a physio can write one in a text editor.

```jsonc
// pack.json
{
  "name": "yoga-desk",
  "version": "1.0.0",
  "description": "Chair-yoga flavored desk stretches",
  "author": "…",
  "license": "CC-BY-4.0",          // for the pack's own text
  "homepage": "https://github.com/…/yoga-desk-pack",
  "stretches": [ /* records per §2.1 */ ]
}
```

Rules:

- Stretch `id`s are namespaced as `<pack>/<id>` internally (`default/chin-tuck`, `yoga-desk/seated-pigeon`) so packs never collide. Inside a pack, ids are bare.
- Packs are merged in `config.packs` order; a later pack can shadow an earlier one's id to replace it.
- `overrides` in the user config apply last, so someone can disable one stretch or change one duration without touching any pack.
- Install: `stretchbreak add ./my-pack`, `stretchbreak add github:user/repo`, `stretchbreak remove yoga-desk`, `stretchbreak packs` to list.
- Every pack is validated against `schema/stretch.schema.json` on install; invalid packs are rejected with the exact field that failed. `steps` are required everywhere; `feel` and `avoid` are required in the default pack.
- The **default pack** ships with the core and is the curated, conservative set. Specialized or opinionated content (rehab protocols, yoga sequences, standing-desk-only sets, a language translation) belongs in a community pack, not the default.

### 2.4 History store (`~/.stretchbreak/history.jsonl`)

One line per shown stretch: `{ts, id, area, surface, wait_s, completed?}`. Used for rotation, frequency caps, and an optional "today you stretched neck ×2, wrists ×1, hips ×0" summary. Never transmitted.

---

## 3. Scheduler

`pick(waitEstimate_s, surface) → Stretch | null`

**Step 1 — Gate.** Return `null` if any of: disabled; wait < `min_wait_s`; in quiet hours; `max_per_hour` reached; last stretch < `min_gap_s` ago; surface disabled.

**Step 2 — Tier from wait estimate.**

| Wait estimate | Tier shown | Rationale |
|---|---|---|
| < 8 s | none | Not worth the context switch |
| 8–20 s | micro | Blink reset, shoulder drop, finger spread. Hands-free only. |
| 20–45 s | short | Chin tuck, neck side bend, prayer stretch |
| 45–120 s | medium | Seated cat-cow, thoracic extension, doorway pec stretch |
| > 120 s | long | Stand up: hip flexor, calf raise, walk-and-look-far |

A stretch may be shown from its own tier or one tier *below* (a short stretch during a medium wait is fine; the reverse is not, because the user would be mid-stretch when Claude finishes).

**Step 3 — Candidate filter.** Remove stretches whose area is off, whose `contra` tags intersect `exclude_tags`, whose posture the user has excluded, and (for micro tier) any with `hands_free: false`.

**Step 4 — Rotation score.** For each candidate, score = hours since that *area* was last shown (higher is better) + small random jitter, with a penalty if the exact stretch was shown in the last 3 picks. Eyes get a fixed bonus every ~20 minutes to approximate the 20-20-20 rule. Pick the top score.

**Step 5 — Record & return.**

### 3.1 Estimating wait time

Neither surface tells you in advance how long Claude will think. The estimate is a heuristic built from cheap signals:

- **Tool name.** From hook input in CC (`PreToolUse` gives `tool_name`). Historical p50 per tool per user, seeded with defaults: `Read`/`Glob`/`Grep` ≈ 1–3 s, `Edit`/`Write` ≈ 3–5 s, `Bash` ≈ 5–30 s (wide), `Agent`/subagent ≈ 60–300 s, `WebFetch` ≈ 5–15 s.
- **Effort level** (`effort.level` is in every hook payload): `high`/`xhigh`/`max` shift the estimate up a tier.
- **Batch size** (`PostToolBatch` → `batch_size`): several tools in flight means a longer batch.
- **Subagent spawn** (`SubagentStart`): reliable "this will be a while" signal; always ≥ medium.
- **Observed** durations feed back into the per-tool p50 so the estimate personalizes over a few days.

Because estimates are fuzzy, the display must degrade gracefully when Claude finishes early (§5).

---

## 4. Surface adapters

### 4.1 Claude Code

**Shape.** One file, `adapters/claude-code/stretchbreak.js`, extending the shared CLI with `hook`, `statusline`, `install` and `uninstall`. `install` merges into `~/.claude/settings.json` (backup first) and wraps any existing status line so it keeps working; `uninstall` restores it exactly.

**Trigger.** Hooks in `~/.claude/settings.json`, all `async: true` so Claude is never blocked:

| Hook | Role |
|---|---|
| `PreToolUse` | Estimate the wait for `tool_name`; if the scheduler says yes, write the stretch to `~/.stretchbreak/cc-current.json`. |
| `SubagentStart` | Same, forced to the long tier. |
| `PostToolUse` / `PostToolUseFailure` | Record the observed duration for that tool (EMA per tool; replaces the seed after 3 samples). |
| `Stop` / `SessionEnd` | Clear the current stretch: Claude is ready. |

**Wait estimate.** Seed p50 per tool (`Read`/`Grep` ≈ 2 s, `Edit` ≈ 4 s, `WebFetch` ≈ 12 s, `Bash` ≈ 20 s, `Agent` ≈ 150 s, MCP tools ≈ 10 s), multiplied by effort level (`high` ×1.3, `xhigh`/`max` ×1.6), then personalised from observed durations. Only estimates at or above `min_wait_s` reach the scheduler.

**Display.** Claude Code writes hook output to its debug log on tool events, not the transcript, so the **status line is the display**. The `statusline` command prints the wrapped previous status line (if any) and then the stretch, layered by `verbosity`: `cue` is one line with a countdown; `steps` (default) adds the numbered steps beneath; `full` adds Feel and Avoid. Claude Code re-runs the status line on its own events plus a 2-second `refreshInterval` for the countdown. The line disappears on `Stop` or when the stretch's time plus a short grace period runs out.

No terminal detection, no images, no local server. Works identically over SSH, in VS Code's terminal, and with screen readers. Not applicable to Claude Code on the web, which doesn't read user settings.

### 4.2 Cowork

**Shape.** A Cowork plugin (`adapters/cowork/plugin`) made of three skills and one CLI (`scripts/sb.js`) that wraps the core scheduler. `build.sh` vendors `core/` and `packs/default/` into the plugin so it never drifts from the repo, and zips a `.plugin` file.

**Trigger.** The `stretch-break` skill is ambient: before any work expected to keep the user waiting 20 s or more (long shell commands, builds, batches, research sweeps, subagents) it calls `sb.js show --wait <estimate>` and renders the result. Cowork lacks a formal hook API today; the skill approach means the plugin works without one, and can move to hooks if/when they arrive.

**Ask first.** The first time in a task a stretch would be shown, the skill asks: this session / always / not now / turn off. "Always" sets `session_opt_in: true` so later tasks skip the question; "turn off" sets `enabled: false`.

**Display.** `sb.js show` prints the chosen stretch as JSON, then a self-contained HTML fragment (cue, numbered steps, Feel and Avoid lines, countdown bar) styled with Cowork's CSS variables so it works in light and dark. The skill hands that fragment to Cowork's inline widget renderer, which draws it directly in the chat. Rendering is done by the script rather than by the model so every card looks identical. If the widget tool is unavailable in a session, the skill falls back to a one-line text cue. Because the card lives in the transcript there is no explicit `done`; the countdown simply finishes.

**On demand and settings.** The `stretch` skill shows one immediately (`--force`, optional `--area`), bypassing caps. The `stretch-settings` skill maps plain-language requests ("I have a wrist injury", "don't make me stand", "fewer", "no stretches after 10pm", "add the pack at ~/x") onto `sb.js config set` calls against the same `~/.stretchbreak/config.json` Claude Code uses. In cloud sessions the home folder may reset between tasks; the skill can keep a copy in a connected folder.

### 4.3 Shared: writing standard

Both surfaces render the same text, so the text has to carry everything. The standard (enforced in `docs/PACKS.md` and by the validator): a `cue` that works alone, `steps` that each name a body part, a direction and a timing, a `feel` line so the user knows they're doing it right, and an `avoid` line with the common mistake and the stop condition. Plain words over anatomy; "the top of the forearm" beats "extensor compartment".

---

## 5. Interaction details

- **Claude finishes early.** Display clears immediately in CC (status line reverts), and in Cowork the panel fades. No "are you done?" prompt, ever. The history entry is marked `completed: false` so it can be re-offered sooner.
- **User dismisses.** Any keypress in CC that isn't the "show" key just carries on; the cue is one line and stays out of the way. Cowork panel has an ✕. Dismissals count toward `max_per_hour` so a dismissed user isn't nagged.
- **Snooze.** `stretchbreak snooze 30m` from the CLI or the panel.
- **Daily summary** (opt-in): on session start or via `stretchbreak today`, a one-line "Yesterday: 9 stretches · neck 3 · wrists 2 · eyes 2 · hips 2".
- **Accessibility.** Everything is text, so it reads correctly in screen readers and at any zoom. The only motion is the Cowork countdown bar, which carries no meaning on its own.

---

## 6. Evidence basis (why these rules)

- Stanford EH&S recommends a 30–60 s microbreak roughly every 20 minutes to interrupt sustained postures, and the 20-20-20 rule for eyes (every 20 min, look 20 ft away for 20 s). This sets `min_gap_s` ≈ 4 min and the eye-bonus cadence.
- A 2022 BMJ Open systematic review of workplace exercise interventions found short, frequent microbreaks reduce musculoskeletal discomfort in office workers; practitioner guidance clusters around 1–2 min of movement every 30–60 min, ≈ 12 min/day total. `max_per_hour: 6` with 10–60 s stretches lands in that range.
- The library's areas map to the recognized desk-posture problems: upper-trapezius and forward-head loading (neck), pec shortening and scapular weakness (shoulders / upper back), forearm flexor shortening (wrists / hands), psoas shortening (hips), and accommodative eye strain (eyes).

Standard disclaimer for the product copy: this is general wellness guidance, not medical advice; anyone with an existing injury should add the relevant `exclude_tags` or consult a clinician.

---

## 7. Open source model

**Licensing.** Code (core, adapters, scripts) is MIT. Stretch text in the default pack is CC BY 4.0, so pack authors can reuse and adapt the copy with attribution. Community packs choose their own license for their content; the tooling doesn't care.

**Repo layout.**

```
stretchbreak/
├── core/                # scheduler, config, history, pack loader (no deps)
├── adapters/
│   ├── claude-code/     # hooks config, status line script, terminal renderer
│   └── cowork/          # plugin manifest, skill, panel HTML, settings page
├── packs/default/       # the curated default pack (pack.json)
├── schema/              # JSON Schema for stretch records + pack.json + config.json
├── scripts/validate.js  # pack validator (also runs in CI and on `stretchbreak add`)
├── docs/                # this spec, pack authoring + writing guide
└── .github/workflows/   # validate packs on every PR
```

**Take-what-you-want.** Each directory is independently useful: `core/scheduler` is a pure function with no I/O, `packs/default` is one JSON file, and each adapter is a small folder. No cross-imports between adapters.

**Contribution paths, from lightest to heaviest.**

1. *Use it.* Nothing to contribute; `overrides` covers most personalization.
2. *Publish a pack.* A repo with a `pack.json`. Listed in `docs/PACKS.md` via PR (an awesome-list, not a registry, to keep it zero-infra).
3. *Improve the default pack.* PR against `packs/default`. Must pass the validator and the CONTRIBUTING criteria: widely taught, low-risk, correct `contra` tags, a `counter` field, and text that meets the writing standard (§4.3).
4. *Core / adapters.* Normal code PRs. New surfaces (Cursor, VS Code, Zed, a menu-bar app) are welcome as new adapter directories following the `pick`/`done` contract.

**Governance for now.** Maintainer-reviewed; small enough that a CODEOWNERS file is sufficient. Revisit if community packs take off.

---

## 8. Open questions

1. **Hook coverage in Cowork.** Confirm whether Cowork exposes lifecycle hooks; if so the Cowork adapter collapses to the same script as CC.
2. **Translations.** The record format is language-agnostic (`pack.language`), but the scheduler currently assumes one active language. Decide whether a translated pack replaces the default or sits beside it.
3. **Name.** "StretchBreak" is a placeholder; something that nods to the "thinking" moment might be better.

---

## 9. Milestones

| # | Deliverable | Notes |
|---|---|---|
| M0 | Spec + default pack (20 stretches, full text) | ✅ |
| M1 | Core: scheduler with tests; pack validator | ✅ |
| M2 | Cowork plugin: 3 skills + CLI + inline text card | ✅ `adapters/cowork` (v0.1) |
| M3 | Claude Code adapter: hooks + status line | ✅ `adapters/claude-code` (v0.1) |
| M4 | Pack install commands (`add github:…`) and `docs/PACKS.md` community list | Next |
| M5 | First translated pack as a worked example | Community |
