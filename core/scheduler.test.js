// Run: node --test core/
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pick, tierForWait, inQuietHours } = require("./scheduler.js");

const pack = require(path.join(__dirname, "..", "packs", "default", "pack.json"));
const stretches = pack.stretches.map((s) => ({ ...s, id: `default/${s.id}` }));
const NOON = new Date(2026, 0, 1, 12, 0, 0).getTime();
const base = { surface: "claude-code", now: NOON, stretches, history: [], random: () => 0.5 };

test("tierForWait", () => {
  const cfg = { min_wait_s: 8 };
  assert.equal(tierForWait(3, cfg), null);
  assert.equal(tierForWait(10, cfg), "micro");
  assert.equal(tierForWait(30, cfg), "short");
  assert.equal(tierForWait(60, cfg), "medium");
  assert.equal(tierForWait(200, cfg), "long");
});

test("quiet hours wrap midnight", () => {
  const at = (h) => new Date(2026, 0, 1, h, 0).getTime();
  assert.equal(inQuietHours(at(23), [["22:00", "08:00"]]), true);
  assert.equal(inQuietHours(at(3), [["22:00", "08:00"]]), true);
  assert.equal(inQuietHours(at(12), [["22:00", "08:00"]]), false);
});

test("short waits return nothing", () => assert.equal(pick({ ...base, waitEstimateS: 3 }), null));

test("micro wait yields a hands-free micro stretch", () => {
  const s = pick({ ...base, waitEstimateS: 10 });
  assert.ok(s); assert.equal(s.tier, "micro"); assert.equal(s.hands_free, true);
});

test("medium wait may yield short or medium, never long", () => {
  for (let i = 0; i < 20; i++) {
    const s = pick({ ...base, waitEstimateS: 60, random: Math.random });
    assert.ok(["short", "medium"].includes(s.tier), s.tier);
  }
});

test("seated posture never picks standing", () => {
  for (let i = 0; i < 20; i++) {
    const s = pick({ ...base, waitEstimateS: 300, random: Math.random, config: { posture: "seated" } });
    assert.notEqual(s.posture, "standing");
  }
});

test("exclude_tags removes contraindicated stretches", () => {
  const s = pick({ ...base, waitEstimateS: 30, config: { exclude_tags: ["neck-injury", "wrist-injury"] } });
  assert.ok(!s.contra.includes("neck-injury") && !s.contra.includes("wrist-injury"));
});

test("area off excludes it", () => {
  for (let i = 0; i < 20; i++) {
    const s = pick({ ...base, waitEstimateS: 30, random: Math.random, config: { areas: { neck: false } } });
    assert.notEqual(s.area, "neck");
  }
});

test("overrides can disable a single stretch", () => {
  const cfg = { overrides: { "chin-tuck": { enabled: false } } };
  for (let i = 0; i < 30; i++) {
    const s = pick({ ...base, waitEstimateS: 30, random: Math.random, config: cfg });
    assert.notEqual(s.id, "default/chin-tuck");
  }
});

test("frequency cap and min gap", () => {
  const h = (agoS, area = "neck") => ({ ts: NOON - agoS * 1e3, id: "default/x", area, surface: "claude-code" });
  assert.equal(pick({ ...base, waitEstimateS: 30, history: [h(60)] }), null, "min_gap");
  const six = [3000, 2500, 2000, 1500, 1000, 500].map((s) => h(s));
  assert.equal(pick({ ...base, waitEstimateS: 30, history: six }), null, "max_per_hour");
});

test("rotation prefers an area not seen recently", () => {
  // Everything but hips seen 5 minutes ago → medium wait should favor hips (seated-figure-four is medium).
  const areas = ["neck", "shoulders", "upper-back", "wrists", "hands", "lower-back", "eyes", "full-body"];
  const history = areas.map((a, i) => ({ ts: NOON - (300 + i) * 1e3, id: `default/${a}`, area: a, surface: "cowork" }));
  const s = pick({ ...base, waitEstimateS: 60, history, config: { min_gap_s: 0, max_per_hour: 100 } });
  assert.equal(s.area, "hips");
});
