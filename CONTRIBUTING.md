# Contributing

Thanks for wanting to help people's necks. There are four ways in, from lightest to heaviest.

## 1. Just use it and tweak your config

Most personalization needs no contribution at all: `areas`, `exclude_tags`, `overrides` and `quiet_hours` in `~/.stretchbreak/config.json` cover a lot. If something you need isn't configurable, open an issue.

## 2. Publish a pack

You don't need to touch this repo. Make a folder with a `pack.json` per [docs/PACKS.md](docs/PACKS.md), validate it, push it anywhere. Then open a PR that adds one line to the community packs table so others can find it.

## 3. Improve the default pack

The default pack is deliberately conservative. A stretch belongs there if it is:

- **Widely taught.** You can find it in mainstream physio / occupational-health guidance, not just one blog.
- **Low-risk for the general population** when done gently, with correct `contra` tags for the people it isn't safe for.
- **Desk-shaped.** Doable in normal clothes, in a normal chair or standing beside it, in under two minutes, without equipment.
- **Not a duplicate.** Check `counter` values: if the same habit is already covered at the same tier, argue for why yours is better or put it in a community pack.

Every default-pack PR needs: the full record including `steps`, `feel` and `avoid` written to the standard in [docs/PACKS.md](docs/PACKS.md#writing-the-instructions), and a passing `node scripts/validate.js`. Text you add is licensed CC BY 4.0.

Reviewers will try the stretch from your text alone, without looking anything up. If they can't do it correctly first time, the text isn't done.

Specialized content (rehab protocols, yoga sequences, opinionated routines) goes in a community pack, not the default.

## 4. Core and adapters

- Keep `core/` dependency-free and side-effect-free. The scheduler is a pure function; I/O lives in adapters.
- New surfaces are new folders under `adapters/` that implement the `pick` / `done` contract in [docs/SPEC.md](docs/SPEC.md) §4. Don't import across adapters.
- Add tests next to the code (`*.test.js`, run with `node --test`).
- Run `node --test scripts/*.test.js core/*.test.js && node scripts/validate.js` before opening a PR. CI runs the same.

## Conventions

- Plain JavaScript, Node ≥ 18, no build step, no dependencies in `core/` or `scripts/`.
- Commit messages: short imperative summary; body explains *why* when it isn't obvious.
- Be kind in reviews. Most contributors here are people with sore shoulders, not maintainers.

## Safety note

Nothing in this project is medical advice. If a proposed stretch has any plausible risk for a common condition, tag it. If you're unsure whether something is safe to include, ask in the PR; erring toward a community pack is always fine.
