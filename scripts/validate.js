#!/usr/bin/env node
// Validates one or more StretchBreak packs. Zero dependencies.
// Usage: node scripts/validate.js packs/default [packs/other ...] [--strict]
//        node scripts/validate.js            (validates every folder under packs/)
// The default pack is always validated in strict mode.
//
// Checks: pack.json shape, every stretch record against the schema rules,
// tier/duration consistency, micro-tier hands_free, unique ids, and (with
// --strict, used for the default pack) that feel and avoid are present.
// StretchBreak is text-first: instructions are the product, so steps are required.

const fs = require("fs");
const path = require("path");

const AREAS = ["neck", "shoulders", "upper-back", "wrists", "hands", "hips", "lower-back", "eyes", "full-body"];
const POSTURES = ["seated", "standing", "either"];
const TIERS = ["micro", "short", "medium", "long"];
const CONTRA = ["neck-injury", "shoulder-injury", "wrist-injury", "back-injury", "hip-injury",
  "knee-injury", "ankle-injury", "pregnancy", "low-blood-pressure", "vertigo", "recent-surgery"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

function tierFor(s) {
  if (s <= 10) return "micro";
  if (s <= 30) return "short";
  if (s <= 59) return "medium";
  return "long";
}

function validateStretch(s, i, strict, errors) {
  const at = (f) => `stretches[${i}]${s && s.id ? ` (${s.id})` : ""}.${f}`;
  if (typeof s !== "object" || s === null) return errors.push(`stretches[${i}]: not an object`);

  const required = ["id", "name", "area", "posture", "duration_s", "tier", "cue", "steps", "counter", "hands_free", "contra"];
  for (const k of required) if (!(k in s)) errors.push(`${at(k)}: missing`);
  const allowed = new Set([...required, "feel", "avoid", "media", "tier_override"]);
  for (const k of Object.keys(s)) if (!allowed.has(k)) errors.push(`${at(k)}: unknown field`);

  if (typeof s.id !== "string" || !KEBAB.test(s.id)) errors.push(`${at("id")}: must be kebab-case`);
  if (typeof s.name !== "string" || s.name.length < 3 || s.name.length > 40) errors.push(`${at("name")}: 3–40 chars`);
  if (!AREAS.includes(s.area)) errors.push(`${at("area")}: must be one of ${AREAS.join(", ")}`);
  if (!POSTURES.includes(s.posture)) errors.push(`${at("posture")}: must be one of ${POSTURES.join(", ")}`);
  if (!Number.isInteger(s.duration_s) || s.duration_s < 3 || s.duration_s > 300) errors.push(`${at("duration_s")}: integer 3–300`);
  if (!TIERS.includes(s.tier)) errors.push(`${at("tier")}: must be one of ${TIERS.join(", ")}`);
  if (typeof s.cue !== "string" || s.cue.length < 10 || s.cue.length > 140) errors.push(`${at("cue")}: 10–140 chars`);
  if (typeof s.counter !== "string" || !KEBAB.test(s.counter)) errors.push(`${at("counter")}: must be kebab-case`);
  if (typeof s.hands_free !== "boolean") errors.push(`${at("hands_free")}: must be boolean`);
  if (s.tier_override !== undefined && typeof s.tier_override !== "boolean") errors.push(`${at("tier_override")}: must be boolean`);

  if (!Array.isArray(s.steps) || s.steps.length < 2 || s.steps.length > 8) errors.push(`${at("steps")}: array of 2–8 strings`);
  else s.steps.forEach((st, j) => { if (typeof st !== "string" || st.length < 15) errors.push(`${at(`steps[${j}]`)}: string ≥15 chars (write a full instruction)`); });
  if (s.feel !== undefined && (typeof s.feel !== "string" || s.feel.length < 15 || s.feel.length > 240)) errors.push(`${at("feel")}: 15–240 chars`);
  if (s.avoid !== undefined && (typeof s.avoid !== "string" || s.avoid.length < 15 || s.avoid.length > 300)) errors.push(`${at("avoid")}: 15–300 chars`);
  if (strict) {
    if (s.feel === undefined) errors.push(`${at("feel")}: required in the default pack (what the user should feel)`);
    if (s.avoid === undefined) errors.push(`${at("avoid")}: required in the default pack (mistakes and stop conditions)`);
  }

  if (!Array.isArray(s.contra)) errors.push(`${at("contra")}: must be an array`);
  else {
    const seen = new Set();
    for (const c of s.contra) {
      if (!CONTRA.includes(c)) errors.push(`${at("contra")}: unknown tag "${c}"`);
      if (seen.has(c)) errors.push(`${at("contra")}: duplicate "${c}"`);
      seen.add(c);
    }
  }

  if (s.media !== undefined) {
    if (typeof s.media !== "object" || s.media === null) errors.push(`${at("media")}: must be an object`);
    else {
      for (const k of Object.keys(s.media)) if (k !== "url") errors.push(`${at(`media.${k}`)}: unknown key (only url is supported; StretchBreak is text-first)`);
      if (s.media.url !== undefined && !/^https?:\/\//.test(s.media.url)) errors.push(`${at("media.url")}: must be http(s) URL`);
    }
  }

  // Cross-field rules
  if (Number.isInteger(s.duration_s) && TIERS.includes(s.tier) && !s.tier_override && tierFor(s.duration_s) !== s.tier) {
    errors.push(`${at("tier")}: "${s.tier}" doesn't match duration_s=${s.duration_s} (expected "${tierFor(s.duration_s)}"); set tier_override: true if intentional`);
  }
  if (s.tier === "micro" && s.hands_free === false) errors.push(`${at("hands_free")}: micro-tier stretches must be hands-free`);
  if (s.tier === "micro" && s.posture === "standing") errors.push(`${at("posture")}: micro-tier stretches can't require standing`);
}

function validatePack(packDir, { strict = false } = {}) {
  const errors = [];
  const file = path.join(packDir, "pack.json");
  if (!fs.existsSync(file)) return [`${file}: not found`];
  let pack;
  try { pack = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { return [`${file}: invalid JSON (${e.message})`]; }

  const required = ["name", "version", "description", "license", "stretches"];
  for (const k of required) if (!(k in pack)) errors.push(`pack.${k}: missing`);
  const allowed = new Set([...required, "author", "homepage", "language"]);
  for (const k of Object.keys(pack)) if (!allowed.has(k)) errors.push(`pack.${k}: unknown field`);

  if (typeof pack.name !== "string" || !KEBAB.test(pack.name)) errors.push("pack.name: must be kebab-case");
  if (typeof pack.version !== "string" || !SEMVER.test(pack.version)) errors.push("pack.version: must be semver x.y.z");
  if (typeof pack.description !== "string" || pack.description.length < 10 || pack.description.length > 200) errors.push("pack.description: 10–200 chars");
  if (typeof pack.license !== "string" || !pack.license) errors.push("pack.license: SPDX id required");
  if (pack.homepage !== undefined && !/^https?:\/\//.test(pack.homepage)) errors.push("pack.homepage: must be http(s) URL");

  if (!Array.isArray(pack.stretches) || pack.stretches.length === 0) errors.push("pack.stretches: non-empty array required");
  else {
    const ids = new Set();
    pack.stretches.forEach((s, i) => {
      validateStretch(s, i, strict, errors);
      if (s && typeof s.id === "string") {
        if (ids.has(s.id)) errors.push(`stretches[${i}].id: duplicate "${s.id}"`);
        ids.add(s.id);
      }
    });
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  let dirs = args.filter((a) => !a.startsWith("--"));
  if (dirs.length === 0) {
    const root = path.join(__dirname, "..", "packs");
    dirs = fs.readdirSync(root).map((d) => path.join(root, d)).filter((d) => fs.statSync(d).isDirectory());
  }
  let failed = false;
  for (const dir of dirs) {
    const errs = validatePack(dir, { strict: strict || path.basename(dir) === "default" });
    if (errs.length) {
      failed = true;
      console.error(`✗ ${dir}`);
      for (const e of errs) console.error(`   ${e}`);
    } else {
      const n = JSON.parse(fs.readFileSync(path.join(dir, "pack.json"), "utf8")).stretches.length;
      console.log(`✓ ${dir} (${n} stretches)`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (require.main === module) main();
module.exports = { validatePack, validateStretch, tierFor };
