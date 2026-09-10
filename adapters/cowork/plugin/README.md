# StretchBreak for Cowork

Turns Claude's thinking time into a quick ergonomic stretch. While a long task runs, a small card appears with a short desk stretch matched to the wait: an 8-second blink reset for a short pause, a stand-up hip flexor stretch for a two-minute agentic run. Each card is written out in full: what to do, step by step, what it should feel like, and what to avoid. No pictures needed. It never blocks anything and never asks you to confirm you did it.

## What's included

- **stretch-break** — the ambient behaviour. The first time a long task would show a stretch, Claude asks whether you want them this session. After that they appear on their own during longer waits, at most a few per hour.
- **stretch** — on demand. Say "give me a stretch" or "something for my neck".
- **stretch-settings** — preferences in plain language: "I have a wrist injury", "don't make me stand up", "fewer stretches", "no stretches after 10pm", "add the pack at ~/my-pack".

Also handy: "snooze stretches for an hour", "turn stretches off", "how much did I stretch today".

## Customizing

Preferences are stored in `~/.stretchbreak/config.json` and shared with the Claude Code adapter, so a change here applies there too. Stretches come in packs; the default pack has 20 conservative desk stretches, and you can add your own or a community pack. Pack format and the full config reference: https://github.com/stretchbreak/stretchbreak

## Notes

- Requires Node.js in the session (present in Cowork's environment).
- In cloud sessions the home folder may reset between tasks; the settings skill can keep a copy in one of your connected folders.
- General wellness guidance, not medical advice. Set exclusions for any injury or condition and check with a clinician about what's right for you.

License: MIT (code), CC BY 4.0 (default pack text and animations).
