# Claude Code adapter (milestone M2 — not yet implemented)

Planned shape, per docs/SPEC.md §4.1:

- `hooks.json` snippet for `~/.claude/settings.json`: async `PreToolUse`, `SubagentStart`, `PostToolUse`, `PostToolBatch`, `Stop`.
- `stretchbreak-hook.sh`: reads hook JSON from stdin, calls `stretchbreak pick` / `done`.
- `statusline.sh`: prints the current cue for the status line.
- `render/`: terminal detection (iTerm2 / Kitty / WezTerm / Ghostty inline images) with status-line and URL fallbacks.

Contributions welcome; open an issue to claim a piece.
