# Writing a stretch pack

A pack is a folder:

```
my-pack/
├── pack.json
├── anim/            # SVG loops, one per stretch (optional if you use url)
└── gif/             # optional raster renders
```

## pack.json

```jsonc
{
  "name": "my-pack",                 // kebab-case; becomes the id namespace (my-pack/<id>)
  "version": "1.0.0",
  "description": "What's in it and who it's for.",
  "author": "You",
  "license": "CC-BY-4.0",            // SPDX id for your text + assets
  "homepage": "https://github.com/you/my-pack",
  "language": "en",
  "stretches": [
    {
      "id": "seated-pigeon",
      "name": "Seated pigeon",
      "area": "hips",                // neck | shoulders | upper-back | wrists | hands | hips | lower-back | eyes | full-body
      "posture": "seated",           // seated | standing | either
      "duration_s": 50,
      "tier": "medium",              // micro ≤10s · short 11–30s · medium 31–59s · long ≥60s
      "cue": "Ankle on knee, hinge forward, 25s each side.",   // ≤ 90 chars, include timing
      "steps": ["Place right ankle on left knee.", "Hinge forward with a flat back.", "Hold 25s, switch."],
      "counter": "glute-tightness",  // what desk habit it counteracts
      "hands_free": false,           // micro-tier stretches must be true
      "contra": ["hip-injury", "knee-injury"],
      "media": { "anim": "seated-pigeon.svg" }   // at least one of anim / gif / url
    }
  ]
}
```

Full rules are enforced by `node scripts/validate.js ./my-pack`, and mirrored in `schema/`. The ones people trip on:

- `tier` must match `duration_s` (set `"tier_override": true` if you really mean it).
- Micro-tier stretches must be `hands_free: true` and must not require standing; they're for 8–20 second waits where the user's hands stay on the keyboard.
- `contra` tags come from a fixed list: `neck-injury, shoulder-injury, wrist-injury, back-injury, hip-injury, knee-injury, ankle-injury, pregnancy, low-blood-pressure, vertigo, recent-surgery`. Open an issue to propose a new one.
- Referenced `anim` / `gif` files must exist in the pack folder.

## Animations

The house style is a single-color line figure on a transparent background, 200×200 viewBox, 2–4 second CSS loop, `currentColor` for strokes so it inherits the host theme. See `docs/ANIMATION-STYLE.md` (coming with milestone M3). Until then, the placeholder SVGs in `packs/default/anim/` show the structure.

You don't have to make animations. A pack with `media.url` pointing at a video or page is valid; users on text-only mode never see media anyway.

## Installing a pack

```
stretchbreak add ./my-pack               # local folder
stretchbreak add github:you/my-pack      # git repo with pack.json at root
stretchbreak packs                       # list installed
stretchbreak remove my-pack
```

Or edit `~/.stretchbreak/config.json` → `"packs": ["default", "./my-pack"]`. Later packs shadow earlier ones on id collisions, so a pack can deliberately replace a default stretch by reusing its id.

## Ideas for packs

- Translations of the default pack (`"language": "de"`)
- Standing-desk-only sets
- Post-injury or physio-prescribed routines (with the right `contra` tags and a clear description)
- Chair yoga, tai chi, breathing-focused sets
- Team packs with in-jokes and custom animations

## Community packs

Open a PR adding a line here. Keep the description honest about who it's for.

| Pack | Description | Author |
|---|---|---|
| _none yet_ | | |
