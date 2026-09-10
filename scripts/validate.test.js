// Run: node --test scripts/
const test = require("node:test");
const assert = require("node:assert");
const { validateStretch, tierFor } = require("./validate.js");

const good = () => ({
  id: "chin-tuck", name: "Chin tuck", area: "neck", posture: "either", duration_s: 20, tier: "short",
  cue: "Glide chin straight back, hold 5s × 3.", counter: "forward-head", hands_free: true, contra: [],
  media: { url: "https://example.com/chin-tuck" },
});

function errorsFor(s) { const e = []; validateStretch(s, 0, null, e); return e; }

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

test("media requires at least one entry", () => {
  const s = good(); s.media = {};
  assert.ok(errorsFor(s).some((e) => e.includes("at least one")));
});

test("unknown fields rejected", () => {
  const s = good(); s.foo = 1;
  assert.ok(errorsFor(s).some((e) => e.includes("unknown field")));
});
