---
name: stretch-settings
description: Changes the user's StretchBreak preferences in plain language: which body areas to include, injuries to avoid, seated-only, how often, quiet hours, and adding or removing stretch packs. Triggers on "stretch settings", "configure stretches", "I have a wrist injury", "don't make me stand up", "fewer stretches", "more stretches", "no stretches after 10pm", "add a stretch pack", "use my own stretches", "reset stretch settings".
---

# Stretch settings

Translate what the user says into config changes. Preferences live in a small JSON file and are shared with every StretchBreak surface (Claude Code, Cowork). Apply changes with the CLI; never hand-edit the file.

Read current settings: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config get`
Set a value: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config set <key> <json-value>`
Reset everything: `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config reset`

## Mapping what people say to settings

| User says | Command |
|---|---|
| "turn stretches off / on" | `config set enabled false` / `true` |
| "skip wrist stretches", "no eye stuff" | `config set areas.wrists false` (areas: neck, shoulders, upper-back, wrists, hands, hips, lower-back, eyes, full-body) |
| "I have a bad neck / wrist injury / back problems / I'm pregnant / I get dizzy" | `config set exclude_tags '["neck-injury"]'` — tags: neck-injury, shoulder-injury, wrist-injury, back-injury, hip-injury, knee-injury, ankle-injury, pregnancy, low-blood-pressure, vertigo, recent-surgery. Read the existing list first and merge, don't overwrite. |
| "don't make me stand", "seated only" | `config set posture seated`; "standing is fine" → `either` |
| "fewer stretches" | halve `max_per_hour` (default 6, min 1) and raise `min_gap_s` (default 240) to 600 |
| "more stretches" | raise `max_per_hour` to 10 and lower `min_gap_s` to 120 |
| "only during long waits" | `config set min_wait_s 45` |
| "no stretches after 10pm / before 9" | `config set quiet_hours '[["22:00","09:00"]]'` (24h, wraps midnight) |
| "just text, no animation" | `config set media text` |
| "add the pack at ~/my-pack" / "use this repo's pack" | read current `packs`, append the path, `config set packs '["default","~/my-pack"]'`. Verify with `sb.js list` that it loaded; if the CLI warns the pack was not found, tell the user the path and that the folder needs a `pack.json`. |
| "remove the yoga pack" | remove it from the `packs` array and set the array again |
| "disable the chin tuck" | `config set overrides.chin-tuck '{"enabled":false}'` (ids from `sb.js list`, without the `default/` prefix) |
| "make the chin tuck 30 seconds" | `config set overrides.chin-tuck '{"duration_s":30}'` |
| "ask me each session again" | `config set session_opt_in false` |
| "reset" | `config reset` |

Confirm every change in one short sentence stating the new value. For a list of changes, one sentence total.

## Where settings are stored

By default in `~/.stretchbreak/config.json` on the machine running this session. When Cowork is running on the user's own computer this persists between tasks. In a cloud session it may not; if `config get` comes back with defaults when the user expected saved settings, explain that, and offer to keep a copy in one of their connected folders: write the same JSON to `<folder>/.stretchbreak/config.json` and tell them to say "load my stretch settings from <folder>" at the start of future tasks (then copy it into `~/.stretchbreak/config.json`).

## Showing settings

When asked "what are my stretch settings", run `config get` and summarize in prose (areas off, exclusions, posture, frequency, quiet hours, packs). Do not paste the JSON unless they ask for it.

## Safety

Take injury and condition mentions seriously: set the exclusion first, then confirm. Never talk anyone out of an exclusion. This is general wellness guidance, not medical advice.
