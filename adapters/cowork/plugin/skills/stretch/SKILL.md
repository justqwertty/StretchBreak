---
name: stretch
description: Shows the user one desk stretch on demand, right now, optionally for a specific body area. Triggers on "give me a stretch", "stretch", "/stretch", "my neck hurts, what can I do", "quick shoulder stretch", "eye break", "I've been sitting too long", "something for my wrists".
---

# Stretch (on demand)

Show one stretch immediately. This bypasses the frequency caps because the user asked.

## Steps

1. Work out the area, if the user named one, and map it to a pack area: `neck`, `shoulders`, `upper-back`, `wrists`, `hands`, `hips`, `lower-back`, `eyes`, `full-body`. "Back" alone → `lower-back`. "Arms" or "forearms" → `wrists`. "Legs" or "sitting too long" → `hips`. "Screen" or "eyes tired" → `eyes`. If no area is named, omit `--area` and let the scheduler rotate.
2. Work out the length. If the user says "quick" use `--wait 30`; "proper" or "longer" use `--wait 180`; otherwise `--wait 60`.
3. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js show --force --surface cowork --wait <N> [--area <area>]`.
4. Render the HTML part of the output with the inline widget tool (`show_widget`), title `stretch_<id>`, one loading message. If the widget tool is not available, give the name in bold, the cue, the steps as a numbered list, and one line each for "Feel:" and "Avoid:", all taken verbatim from the JSON line.
5. Add at most one sentence of text. Offer another only if they ask.

If the output is `null` (can happen when the user's exclusions remove every stretch for that area, or the area is turned off), say so in one sentence and offer a neighbouring area. Do not invent a stretch that is not in the pack.

## Follow-ups

- "another one" / "different one" → run again with the same flags.
- "the other side" → the steps already cover both sides; say so briefly.
- "that hurts" → stop, do not offer more for that area, and suggest the matching exclusion via the `stretch-settings` skill and checking with a clinician.
