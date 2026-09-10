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
4. **User owns the experience.** Opt out of areas (injuries), set intensity (seated-only vs. willing to stand), quiet hours, frequency caps, and media style. Bring your own stretches from a physio.
5. **Same brain, two faces.** One shared core (library + scheduler + config) with a thin adapter per surface. Preferences follow the user across Claude Code and Cowork.
6. **Open by default.** MIT-licensed code, CC BY 4.0 assets, and a pack format anyone can publish to. The default library is just the first pack. Every piece (scheduler, packs, animations, adapters) is useful on its own, so people can take only the part they like.

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
│ • hooks (Pre/PostTool,│       │ • plugin + skill      │
│   Stop, SubagentStart)│       │ • HTML panel w/ loop  │
│ • status line text    │       │   animation           │
│ • inline image / URL  │       │ • same config file    │
└───────────────────────┘       └───────────────────────┘
```

The core is a small CLI (`stretchbreak`) written in a language with zero runtime dependencies for the CC path (Go or a single-file Node script are both fine; Node is the pragmatic choice since Claude Code users already have it). Adapters call `stretchbreak pick --wait 25` and get back JSON describing what to show, or nothing.

### 2.1 Stretch record

```jsonc
{
  "id": "neck-side-bend",
  "name": "Neck side bend",
  "area": "neck",                 // neck | shoulders | upper-back | wrists | hands | hips | lower-back | eyes | full-body
  "posture": "seated",            // seated | standing | either
  "duration_s": 30,               // total time incl. both sides / all reps
  "tier": "medium",               // micro (≤10s) | short (11–30s) | medium (31–59s) | long (≥60s)
  "cue": "Ear toward shoulder, opposite shoulder down. 15s each side.",
  "steps": [                      // optional, for the expanded / Cowork view
    "Sit tall, drop right ear toward right shoulder.",
    "Keep left shoulder pressed down. Hold 15s.",
    "Switch sides."
  ],
  "counter": "forward-head",      // what desk habit it counteracts (used for rotation + copy)
  "hands_free": true,             // can be done without letting go of mouse/keyboard? (false = needs both hands)
  "contra": ["neck-injury"],      // contraindication tags matched against user's exclusions
  "media": {
    "anim": "neck-side-bend.svg", // looping line-figure animation (SVG/CSS) shipped with the library
    "gif": "neck-side-bend.gif",  // raster fallback
    "url": "https://…"            // external reference (last resort / user-provided stretches)
  }
}
```

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
  "media": "auto",                 // auto | anim | gif | text | url | off
  "verbosity": "cue",              // cue (one line) | steps (expanded)
  "surfaces": {
    "claude-code": { "enabled": true, "inline_images": "auto", "status_line": true },
    "cowork":      { "enabled": true, "panel_position": "bottom-right" }
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

A **pack** is a folder (or git repo) containing a `pack.json` and its media assets:

```
my-pack/
├── pack.json          # metadata + stretches array (same record format as §2.1)
├── anim/              # SVG loops referenced by media.anim
└── gif/               # optional raster renders referenced by media.gif
```

```jsonc
// pack.json
{
  "name": "yoga-desk",
  "version": "1.0.0",
  "description": "Chair-yoga flavored desk stretches",
  "author": "…",
  "license": "CC-BY-4.0",          // for the pack's own text + assets
  "homepage": "https://github.com/…/yoga-desk-pack",
  "stretches": [ /* records per §2.1 */ ]
}
```

Rules:

- Stretch `id`s are namespaced as `<pack>/<id>` internally (`default/chin-tuck`, `yoga-desk/seated-pigeon`) so packs never collide. Inside a pack, ids are bare.
- Packs are merged in `config.packs` order; a later pack can shadow an earlier one's id to replace it.
- `overrides` in the user config apply last, so someone can disable one stretch or change one duration without touching any pack.
- Install: `stretchbreak add ./my-pack`, `stretchbreak add github:user/repo`, `stretchbreak remove yoga-desk`, `stretchbreak packs` to list.
- Every pack is validated against `schema/stretch.schema.json` on install; invalid packs are rejected with the exact field that failed.
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

**Trigger.** Hooks in `~/.claude/settings.json`:

| Hook | Role |
|---|---|
| `PreToolUse` (async) | Call `stretchbreak pick --tool $tool_name --effort $level`. If a stretch returns, render it. |
| `SubagentStart` (async) | Force `--wait 120` (long tier). |
| `PostToolUse` / `PostToolBatch` / `Stop` (async) | Call `stretchbreak done` → clears display, records observed duration. |
| `SessionStart` | Warm cache, optionally print the day's summary. |

All hooks run `async: true` so they never block Claude. They're single-purpose shell one-liners; logic lives in the CLI.

**Display ladder** (the "URL or GIF" fallback chain), chosen by `surfaces.claude-code.inline_images`:

1. **Inline animation** if the terminal supports images (iTerm2 inline images protocol, Kitty graphics protocol, WezTerm, Ghostty; detected via `TERM_PROGRAM` / `TERM` / `KITTY_WINDOW_ID`). Renders the GIF at ~200 px wide beside the cue.
2. **Status line + text cue** otherwise. A one-liner in the status line (`🧘 Neck side bend · 15s each side · [s] show`), plus the cue text in the transcript area if `verbosity: steps`.
3. **Keypress → browser.** The cue includes a short local URL (`http://127.0.0.1:7391/s/neck-side-bend`) served by the CLI; opening it shows the animation full-size. This is the "URL" mode and also the mode for user-provided stretches that only have an external link.
4. **Text only** (`media: text`) for SSH sessions, screen readers, and people who just want the words.

Terminal detection should be conservative: when in doubt, use the status line, since a broken inline image is worse than no image.

### 4.2 Cowork

**Trigger.** A Cowork plugin whose skill is instructed to run `stretchbreak pick` at the start of any multi-step task, and `stretchbreak done` when the task's tool burst completes. (Cowork lacks a formal hook API today; the skill approach means the plugin works without one, and can move to hooks if/when they arrive.)

**Display.** A small non-modal HTML panel anchored `panel_position` (default bottom-right of the task view) showing the looping animation, the cue, and a countdown ring matched to `duration_s`. Because Cowork is an app surface, this is the "GIF" experience at its best: no terminal caveats. The panel fades out on `done` or when the countdown ends, whichever is first.

Since Cowork users are less terminal-native, the Cowork side also hosts the **settings UI**: a preferences page that reads/writes the same `~/.stretchbreak/config.json`, so a change there is immediately reflected in Claude Code.

### 4.3 Shared: media assets

Every stretch ships with a stylized looping animation: a single-color line figure, 2–4 s loop, no text baked in, ~200×200. Two formats generated from one source: SVG+CSS (for Cowork and the local URL page, crisp at any size, theme-aware) and GIF (for terminals with image support). Keeping the style uniform is what makes the library feel like one product; it also sidesteps licensing issues with filmed clips.

---

## 5. Interaction details

- **Claude finishes early.** Display clears immediately in CC (status line reverts), and in Cowork the panel fades. No "are you done?" prompt, ever. The history entry is marked `completed: false` so it can be re-offered sooner.
- **User dismisses.** Any keypress in CC that isn't the "show" key just carries on; the cue is one line and stays out of the way. Cowork panel has an ✕. Dismissals count toward `max_per_hour` so a dismissed user isn't nagged.
- **Snooze.** `stretchbreak snooze 30m` from the CLI or the panel.
- **Daily summary** (opt-in): on session start or via `stretchbreak today`, a one-line "Yesterday: 9 stretches · neck 3 · wrists 2 · eyes 2 · hips 2".
- **Accessibility.** Cue text is always present, animations are never the sole carrier of meaning, and `media: text` disables motion entirely.

---

## 6. Evidence basis (why these rules)

- Stanford EH&S recommends a 30–60 s microbreak roughly every 20 minutes to interrupt sustained postures, and the 20-20-20 rule for eyes (every 20 min, look 20 ft away for 20 s). This sets `min_gap_s` ≈ 4 min and the eye-bonus cadence.
- A 2022 BMJ Open systematic review of workplace exercise interventions found short, frequent microbreaks reduce musculoskeletal discomfort in office workers; practitioner guidance clusters around 1–2 min of movement every 30–60 min, ≈ 12 min/day total. `max_per_hour: 6` with 10–60 s stretches lands in that range.
- The library's areas map to the recognized desk-posture problems: upper-trapezius and forward-head loading (neck), pec shortening and scapular weakness (shoulders / upper back), forearm flexor shortening (wrists / hands), psoas shortening (hips), and accommodative eye strain (eyes).

Standard disclaimer for the product copy: this is general wellness guidance, not medical advice; anyone with an existing injury should add the relevant `exclude_tags` or consult a clinician.

---

## 7. Open source model

**Licensing.** Code (core, adapters, scripts) is MIT. Stretch text, cues, and animation assets in the default pack are CC BY 4.0, so pack authors can reuse the visual style and copy with attribution. Community packs choose their own license for their content; the tooling doesn't care.

**Repo layout.**

```
stretchbreak/
├── core/                # scheduler, config, history, pack loader (no deps)
├── adapters/
│   ├── claude-code/     # hooks config, status line script, terminal renderer
│   └── cowork/          # plugin manifest, skill, panel HTML, settings page
├── packs/default/       # the curated default pack (pack.json + anim/)
├── schema/              # JSON Schema for stretch records + pack.json + config.json
├── scripts/validate.js  # pack validator (also runs in CI and on `stretchbreak add`)
├── docs/                # this spec, pack authoring guide, animation style guide
└── .github/workflows/   # validate packs on every PR
```

**Take-what-you-want.** Each directory is independently useful: `core/scheduler` is a pure function with no I/O, `packs/default` is plain JSON + SVG, the terminal renderer takes any image, and the Cowork panel is a single HTML file. No cross-imports between adapters.

**Contribution paths, from lightest to heaviest.**

1. *Use it.* Nothing to contribute; `overrides` covers most personalization.
2. *Publish a pack.* A repo with `pack.json` + assets. Listed in `docs/PACKS.md` via PR (an awesome-list, not a registry, to keep it zero-infra).
3. *Improve the default pack.* PR against `packs/default`. Must pass the validator and the CONTRIBUTING criteria: widely taught, low-risk, correct `contra` tags, a `counter` field, and an animation in the house style.
4. *Core / adapters.* Normal code PRs. New surfaces (Cursor, VS Code, Zed, a menu-bar app) are welcome as new adapter directories following the `pick`/`done` contract.

**Governance for now.** Maintainer-reviewed; small enough that a CODEOWNERS file is sufficient. Revisit if community packs take off.

---

## 8. Open questions

1. **Hook coverage in Cowork.** Confirm whether Cowork exposes lifecycle hooks; if so the Cowork adapter collapses to the same script as CC.
2. **Terminal image support matrix.** Verify inline rendering on iTerm2, Kitty, WezTerm, Ghostty, and confirm VS Code's integrated terminal behavior (likely status-line fallback).
3. **Animation pipeline.** Author in one format (probably SVG with CSS keyframes) and render GIFs with a headless browser at build time.
4. **Name.** "StretchBreak" is a placeholder; something that nods to the "thinking" moment might be better (Think & Stretch, Idle Hands, Pause Posture…).

---

## 9. Milestones

| # | Deliverable | Notes |
|---|---|---|
| M0 | This spec + `library.json` (20 stretches) | ✅ this document |
| M1 | Core CLI: `pick`, `done`, `snooze`, `today`; config + history; scheduler with tests | Node, no deps |
| M2 | Claude Code adapter: hooks config, status line, text + URL modes | Testable in your own setup |
| M3 | Animation set: 20 SVG loops in one style + GIF renders | Style exploration first |
| M4 | Inline-image mode for supported terminals | After the support matrix |
| M5 | Cowork plugin: skill + panel + settings UI | Shares config with CC |
