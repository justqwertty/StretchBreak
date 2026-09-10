---
name: stretch-break
description: Shows the user a short ergonomic stretch while a long task runs, so waiting time becomes a posture break. Applies automatically during any multi-step task expected to take 20 seconds or more; the user does not need to ask. Also triggers on "stretch while you work", "remind me to stretch", "posture breaks", "stop showing stretches", "snooze stretches".
---

# Stretch break (ambient)

Turn the user's waiting time into a quick stretch. The user is likely sitting at a desk; while a long tool run or multi-step task is in progress they have nothing to do, so a 10–60 second movement fits exactly there. Never let it cost them time.

## Session opt-in (ask first)

The first time in a task that a stretch would be shown, ask before showing anything. Use AskUserQuestion with a single question: "Want a quick stretch while I work on this? I'll show one during longer waits." Options: "Yes, this session", "Yes, always", "Not now", "Turn off".

- "Yes, this session" → proceed for the rest of the task without asking again. Write nothing.
- "Yes, always" → run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config set session_opt_in true` so future tasks skip the question.
- "Not now" → do not show stretches for the rest of this task. Do not ask again this task.
- "Turn off" → run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config set enabled false` and confirm in one sentence that stretches are off and can be turned back on by saying "turn stretches on".

If the config already has `enabled: false`, never ask and never show. Check with `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js config get` once at the start of the first long task in a session; cache the answer mentally for the rest of the task. If `session_opt_in` is already true in the config, skip the question and show stretches directly (the user opted in earlier on this machine).

## When to show one

Right before starting work that will keep the user waiting: a long shell command, a build or test run, a batch of file processing, a web research sweep, a subagent, or any sequence of several tool calls. Estimate the wait roughly:

| Expected wait | Pass `--wait` |
|---|---|
| Under 20 s | do not show anything |
| 20–45 s (a few tool calls, a fetch) | 30 |
| 45–120 s (build, test suite, several files, research) | 60 |
| 2 min or more (subagents, big batch, long generation) | 180 |

The scheduler enforces frequency caps and gaps itself; call it freely and respect a `null` answer silently.

## How to show one

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js show --wait <N> --surface cowork`.
2. If the output is `null`, show nothing and continue with the task. Do not mention stretches.
3. Otherwise the output is one JSON line, a `---` separator, then widget HTML. Render the HTML with the inline widget tool (`show_widget`) if it is available in this session, with the title `stretch_<id>` and a single loading message such as "Rolling out a stretch". If the widget tool is not available, write the cue in one short line instead: "Stretch while I work: **Neck side bend** · Ear toward shoulder, opposite shoulder down, 15s each side."
4. Then immediately start the actual work. Do not wait for the user, do not ask whether they did it, do not narrate the stretch.

Keep it to one card per wait. Never show a card when the user is mid-conversation and nothing long is about to run.

## Commands the user may give

- "snooze stretches" / "not for a while" → `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js snooze 60` (or the number of minutes they say). Confirm in one short sentence.
- "stop showing stretches" / "turn stretches off" → `config set enabled false`. Confirm.
- "turn stretches on" → `config set enabled true`. Confirm.
- "how much did I stretch today" → `node ${CLAUDE_PLUGIN_ROOT}/scripts/sb.js today` and relay the line.
- Anything about preferences (areas, injuries, standing, quiet hours, packs) → follow the `stretch-settings` skill.
- "give me a stretch now" → follow the `stretch` skill.

## Tone

Light and brief. No health lectures, no exclamation marks, no emoji. The card speaks for itself; the surrounding text should be at most one short sentence, and usually nothing.

## Safety

This is general wellness guidance, not medical advice. If the user mentions pain, an injury, pregnancy, dizziness, or a medical condition, stop showing stretches for that session, suggest they set the matching exclusion (see `stretch-settings`), and recommend they check with a clinician about what is right for them.
