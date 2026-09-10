# StretchBreak for Claude Code

Shows a short desk stretch in the status line while Claude Code runs something slow. Text only: a one-line cue, and optionally the numbered steps beneath it. Hooks run in the background and never slow Claude down; the stretch clears the moment Claude is ready for you again.

## Install

Needs Node ≥ 18.

```
git clone https://github.com/justqwertty/StretchBreak
cd StretchBreak
node adapters/claude-code/stretchbreak.js install
```

Then restart Claude Code. That's it.

`install` adds hooks and a status line to `~/.claude/settings.json` (a timestamped backup is written first). If you already have a status line, it's kept: StretchBreak runs it and appends its own line(s) beneath, and `uninstall` puts it back exactly as it was.

Optional, so you can type `stretchbreak` from anywhere:

```
npm link        # from the repo root
```

## What you'll see

Before a tool call Claude Code expects to take a while (a `Bash` command, a web fetch, a subagent), the status line gains a line like:

```
🧘 Chin tuck · Glide your head straight back so you make a double chin. Hold 5 seconds, release. Three times.  [18s]
```

With `verbosity` set to `steps` (the default) the numbered steps appear beneath it; `full` adds the Feel and Avoid lines; `cue` keeps it to the one line. The countdown ticks every couple of seconds and the whole thing disappears when Claude finishes its turn.

Short tool calls (reading a file, a small edit) never show anything. The adapter estimates each tool's wait from a seed table and then from what it actually observes on your machine, so after a day it knows that *your* test suite takes 40 seconds.

## Commands

```
stretchbreak off | on                       pause / resume
stretchbreak snooze 60                      quiet for an hour
stretchbreak today                          what you've done today
stretchbreak text --force                   print a stretch right now, in full
stretchbreak config set verbosity cue       cue | steps | full
stretchbreak config set posture seated      never asks you to stand
stretchbreak config set exclude_tags '["wrist-injury"]'
stretchbreak config set packs '["default","~/my-pack"]'
stretchbreak list                           every stretch currently loaded
stretchbreak uninstall
```

All settings live in `~/.stretchbreak/config.json`, shared with the Cowork plugin. See the root README for the full list.

## How it works

| Hook | What the adapter does |
|---|---|
| `PreToolUse` | Estimates the wait for `tool_name` (seed table × effort level, replaced by an observed moving average after 3 samples). Asks the scheduler for a stretch; if one is due, writes it to `~/.stretchbreak/cc-current.json`. |
| `SubagentStart` | Same, with a long wait estimate. |
| `PostToolUse` / `PostToolUseFailure` | Records how long the tool actually took, to improve future estimates. |
| `Stop` / `SessionEnd` | Clears the current stretch. |

All hooks are `async: true`, so they never block Claude. The status line command reads the state file on Claude Code's normal refresh cycle plus a 2-second timer for the countdown. Claude Code doesn't show hook output to the user on tool events, which is why the status line is the display rather than the transcript.

## Notes

- Claude Code on the web doesn't read `~/.claude/settings.json`, so this adapter is for local sessions.
- General wellness guidance, not medical advice. Set `exclude_tags` for any injury or condition and check with a clinician about what's right for you.
