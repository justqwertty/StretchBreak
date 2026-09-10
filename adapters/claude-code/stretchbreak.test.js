// Run: node --test adapters/claude-code/
const test = require("node:test");
const assert = require("node:assert");
const { estimateWait, recordDuration, SEED } = require("./stretchbreak.js");

test("seed estimates: quick tools stay under the 8s gate, Bash and agents don't", () => {
  assert.ok(estimateWait("Read", { level: "medium" }, {}) < 8);
  assert.ok(estimateWait("Edit", { level: "medium" }, {}) < 8);
  assert.ok(estimateWait("Bash", { level: "medium" }, {}) >= 8);
  assert.ok(estimateWait("Agent", { level: "medium" }, {}) >= 120);
});

test("effort raises the estimate", () => {
  const base = estimateWait("Bash", { level: "medium" }, {});
  assert.ok(estimateWait("Bash", { level: "high" }, {}) > base);
  assert.ok(estimateWait("Bash", { level: "max" }, {}) > estimateWait("Bash", { level: "high" }, {}));
});

test("unknown and MCP tools get sensible defaults", () => {
  assert.equal(estimateWait("SomethingNew", null, {}), 8);
  assert.equal(estimateWait("mcp__server__tool", null, {}), 10);
});

test("observed durations replace the seed after three samples", () => {
  const stats = {};
  recordDuration("Bash", 60, stats);
  recordDuration("Bash", 60, stats);
  assert.equal(estimateWait("Bash", null, stats), SEED.Bash, "seed still used with n<3");
  recordDuration("Bash", 60, stats);
  assert.ok(estimateWait("Bash", null, stats) > 40, "EMA of observed 60s runs takes over");
});
