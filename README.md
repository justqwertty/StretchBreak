# StretchBreak

**Turn AI "thinking" time into a quick stretch.**

When Claude Code or Cowork is busy running a long tool call, you're sitting there watching a spinner. StretchBreak fills that wait with a 10–60 second movement targeted at what desk work does to you: forward-head neck strain, rounded shoulders, tight wrists, shortened hip flexors, tired eyes.

It never costs you time. Stretches only appear while the AI is already working, never block anything, and clear the moment it's ready.

> Status: **early**. The spec, default stretch pack, scheduler, validator and a first Cowork plugin are here. The Claude Code adapter is next. See [docs/SPEC.md](docs/SPEC.md) §9 for milestones.

## How it works

1. An adapter (a Claude Code hook, a Cowork plugin skill) notices the AI is about to do something slow and asks the core for a stretch, passing a rough wait estimate.
2. The scheduler picks something the right length for the wait, rotating across body areas over the day, honoring your exclusions, frequency cap and quiet hours.
3. The adapter shows it as text: a one-line cue, numbered steps, what it should feel like, and what to avoid. Written to be followed from the screen; no pictures needed.
4. When the AI finishes, it disappears.

```
~8 s wait      → blink reset, shoulder drop (hands stay on the keyboard)
~30 s wait     → chin tuck, neck side bend, wrist prayer stretch
~60 s wait     → seated cat-cow, chest opener, figure-four
2+ min wait    → stand up: hip flexor stretch, calf raises and a short walk
```

## Customize it

Everything lives in `~/.stretchbreak/config.json` and is shared by every surface:

```jsonc
{
  "min_wait_s": 8,
  "max_per_hour": 6,
  "areas": { "wrists": false },              // turn off whole areas
  "exclude_tags": ["neck-injury"],           // skip anything contraindicated for you
  "posture": "seated",                       // never ask you to stand
  "quiet_hours": [["22:00", "08:00"]],
  "verbosity": "steps",                      // cue | steps | full
  "packs": ["default", "./my-physio-pack"],  // add your own stretches
  "overrides": { "chin-tuck": { "duration_s": 30 } }
}
```

## Add your own stretches

Stretches come in **packs**: a folder with one `pack.json`. No images, no build step; if you can describe a stretch clearly you can write one. Make a pack for yourself, your team, or publish it for everyone. The format and the writing standard are in [docs/PACKS.md](docs/PACKS.md); `node scripts/validate.js ./my-pack` tells you exactly what's wrong if anything is.

Community packs are listed in [docs/PACKS.md](docs/PACKS.md#community-packs). Open a PR to add yours.

## Take just the part you like

Every directory stands alone:

- `core/scheduler.js` — pure function, zero deps. Give it stretches, config, history and a wait estimate; get back a pick.
- `packs/default/` — 20 conservative desk stretches, fully written out, as one JSON file. CC BY 4.0.
- `schema/` — JSON Schema for stretch records, packs and config.
- `scripts/validate.js` — the pack validator, also zero deps.
- `adapters/cowork/` — a Cowork plugin (three skills + CLI); `adapters/cowork/build.sh` produces the installable `.plugin`.
- `adapters/` — one folder per surface. Want StretchBreak in Cursor, Zed, or a menu-bar app? Add a folder that speaks the `pick` / `done` contract in the spec.

## Development

```
node --test scripts/*.test.js core/*.test.js   # tests
node scripts/validate.js                        # validate every pack under packs/
```

No build step, no dependencies. Node ≥ 18.

## Evidence

Timing rules follow standard occupational-health microbreak guidance (30–60 s every ~20 min; the 20-20-20 rule for eyes) and reviews showing short frequent movement breaks reduce musculoskeletal discomfort in office workers. Details and sources in [docs/SPEC.md](docs/SPEC.md) §6.

This is general wellness guidance, not medical advice. If you have an injury or condition, use `exclude_tags`, and talk to a clinician about what's right for you.

## License

Code: [MIT](LICENSE). Default pack text: [CC BY 4.0](packs/default/LICENSE). Community packs choose their own.
