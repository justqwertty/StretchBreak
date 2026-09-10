# Writing a stretch pack

A pack is a folder with one file:

```
my-pack/
└── pack.json
```

No images, no build step. If you can describe a stretch clearly enough that someone does it right the first time, you can write a pack.

## pack.json

```jsonc
{
  "name": "my-pack",                 // kebab-case; becomes the id namespace (my-pack/<id>)
  "version": "1.0.0",
  "description": "What's in it and who it's for.",
  "author": "You",
  "license": "CC-BY-4.0",            // SPDX id for your text
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
      "cue": "Rest your right ankle on your left knee, sit tall, then hinge forward from the hips. 25 seconds each side.",
      "steps": [
        "Sit toward the front of the chair with both feet flat.",
        "Lift your right foot and rest the outside of the ankle on top of the left knee. Let the right knee drop out to the side.",
        "Keep the back straight and hinge forward from the hips until you feel the outer hip.",
        "Hold for a slow count of twenty-five, then switch sides."
      ],
      "feel": "A deep stretch in the outer hip and buttock of the lifted leg.",
      "avoid": "Don't round the back to get lower. Skip this side if the knee complains.",
      "counter": "glute-tightness",  // what desk habit it counteracts
      "hands_free": false,           // micro-tier stretches must be true
      "contra": ["hip-injury", "knee-injury"],
      "media": { "url": "https://example.com/seated-pigeon" }   // optional reference link
    }
  ]
}
```

Rules are enforced by `node scripts/validate.js ./my-pack` and mirrored in `schema/`. The ones people trip on:

- `steps` is required (2–8 steps, each a full sentence of at least 15 characters).
- `feel` and `avoid` are optional in community packs and required in the default pack.
- `tier` must match `duration_s` (set `"tier_override": true` if you really mean it).
- Micro-tier stretches must be `hands_free: true` and must not require standing; they're for 8–20 second waits where the user's hands stay on the keyboard.
- `contra` tags come from a fixed list: `neck-injury, shoulder-injury, wrist-injury, back-injury, hip-injury, knee-injury, ankle-injury, pregnancy, low-blood-pressure, vertigo, recent-surgery`. Open an issue to propose a new one.
- `media` may only contain `url`. StretchBreak is text-first; there is no image or animation support, on purpose.

## Writing the instructions

The text is the whole product, so it has to do the work a picture would. The standard we hold the default pack to:

**Cue (one line, ≤140 characters).** Enough to do the stretch if it's the only thing you read. Name the body part, the movement, and the timing. "Drop your right ear toward your right shoulder, keeping the left shoulder down. 15 seconds, then switch." Not "Neck stretch, 30s."

**Steps (2–8).** One action per step, in order. Each step should say *where* (which body part, which side), *which way* (up, back, toward the floor), and *how long or how many* when it matters. Start from a known position ("Sit toward the front of the chair with both feet flat"). Use plain words: "the top of the forearm" not "the extensor compartment"; "make a double chin" not "cervical retraction". Give an escape hatch when the full version isn't possible ("If you can't clasp your hands, hold one wrist").

**Feel.** What the user should notice when it's right, in one or two sentences. Location first ("A stretch along the inside of both forearms"), then quality. This is how they self-correct without a mirror.

**Avoid.** The most common way to do it wrong, and the stop condition. "Don't pull the head with your hand. Stop if you feel pinching on the side you're bending toward." If the stretch has a version to skip under some condition, say it here.

**Timing words.** Prefer "a slow count of fifteen" to "15 seconds"; people count, they don't time. Put breathing in where it matters ("breathe out as you fold").

**Test it.** Read it aloud to someone who has never done the stretch, then watch them. If they hesitate or do it wrong, fix the text, not the person.

## Installing a pack

```
stretchbreak add ./my-pack               # local folder
stretchbreak add github:you/my-pack      # git repo with pack.json at root
stretchbreak packs                       # list installed
stretchbreak remove my-pack
```

Or edit `~/.stretchbreak/config.json` → `"packs": ["default", "./my-pack"]`. Later packs shadow earlier ones on id collisions, so a pack can deliberately replace a default stretch by reusing its id. In the Cowork plugin, just say "add the pack at ~/my-pack".

## Ideas for packs

- Translations of the default pack (`"language": "de"`)
- Standing-desk-only sets
- Post-injury or physio-prescribed routines (with the right `contra` tags and a clear description)
- Chair yoga, tai chi, breathing-focused sets
- Team packs with in-jokes

## Community packs

Open a PR adding a line here. Keep the description honest about who it's for.

| Pack | Description | Author |
|---|---|---|
| _none yet_ | | |
