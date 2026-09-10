// Run: node --test scripts/
const test = require("node:test");
const assert = require("node:assert");
const { validateStretch, tierFor } = require("./validate.js");

const good = () => ({
  id: "chin-tuck", name: "Chin tuck", area: "neck", posture: "either", duration_s: 20, tier: "short",
  cue: "Glide chin straight back, hold 5s × 3.", counter: "forward-head", hands_free: true, contra: [],
  steps: ["Sit tall with your eyes level and the screen straight ahead.", "Slide the head straight back, making a double chin. Hold five seconds."],
  feel: "A stretch at the base of the skull and the back of the neck.",
  avoid: "Don't nod the chin down; the movement is a horizontal glide.",
});

function errorsFor(s, strict = false) { const e = []; validateStretch(s, 0, strict, e); return e; }

test("tierFor boundaries", () => {
  assert.equal(tierFor(10), "micro");
  assert.equal(tierFor(11), "short");
  assert.equal(tierFor(30), "short");
  assert.equal(tierFor(31), "medium");
  assert.equal(tierFor(59), "medium");
  assert.equal(tierFor(60), "long");
});

test("valid record passes", () => assert.deepEqual(errorsFor(good()), []));

test("tier must match duration unless overridden", () => {
  const s = good(); s.tier = "long";
  assert.ok(errorsFor(s).some((e) => e.includes("doesn't match duration_s")));
  s.tier_override = true;
  assert.deepEqual(errorsFor(s), []);
});

test("micro must be hands-free", () => {
  const s = good(); s.duration_s = 8; s.tier = "micro"; s.hands_free = false;
  assert.ok(errorsFor(s).some((e) => e.includes("hands-free")));
});

test("unknown contra tag rejected", () => {
  const s = good(); s.contra = ["bad-knees"];
  assert.ok(errorsFor(s).some((e) => e.includes('unknown tag "bad-knees"')));
});

test("steps are required and must be real instructions", () => {
  const s = good(); delete s.steps;
  assert.ok(errorsFor(s).some((e) => e.includes("steps")));
  const t = good(); t.steps = ["Sit tall.", "Hold."];
  assert.ok(errorsFor(t).some((e) => e.includes("≥15 chars")));
});

test("strict mode requires feel and avoid", () => {
  const s = good(); delete s.feel; delete s.avoid;
  assert.deepEqual(errorsFor(s, false), []);
  const errs = errorsFor(s, true);
  assert.ok(errs.some((e) => e.includes("feel")) && errs.some((e) => e.includes("avoid")));
});

test("media is optional and url-only", () => {
  const s = good(); s.media = { url: "https://example.com/x" };
  assert.deepEqual(errorsFor(s), []);
  s.media = { anim: "x.svg" };
  assert.ok(errorsFor(s).some((e) => e.includes("only url")));
});

test("unknown fields rejected", () => {
  const s = good(); s.foo = 1;
  assert.ok(errorsFor(s).some((e) => e.includes("unknown field")));
});
