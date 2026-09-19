#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "ConstellationLogic.js"), "utf8")
  .replace(/^\.pragma library\s*/, "");
const Sky = { Math, Date, Number, String, Array, Object, JSON, isFinite, console, Intl };
vm.createContext(Sky);
vm.runInContext(src, Sky);

function liveSnapshot(overrides) {
  const snap = Sky.parseSnapshot(JSON.stringify({
    present: true,
    ok: true,
    busy: false,
    runs: [
      { id: "ok1", name: "Briefing", status: "completed", started_at: "2026-09-18T22:05:00-07:00", tokens: 120, usd: 0.02 },
      { id: "bad1", name: "Ping", status: "failed", started_at: "2026-09-18T23:10:00-07:00", tokens: 3, usd: null, profile: "kid" }
    ],
    summary: { runs: 2, failed: 1, running: 0, tokens: 123, usd: null, usd_billed: 1, cost_coverage: "partial" },
    window: { start: "2026-09-18T18:00:00-07:00", end: "2026-09-19T08:00:00-07:00", tz: "America/Los_Angeles", label: "Last night" },
    profileCount: 2,
    homes: ["default", "kid"]
  }));
  return Object.assign(snap, overrides || {});
}

assert.strictEqual(Sky.barLabel(Sky.demoSnapshot()), "DEMO");
assert.strictEqual(Sky.barMode(Sky.demoSnapshot()), "demo");

const err = Sky.errorSnapshot("unreadable executions.db");
assert.strictEqual(Sky.barLabel(err), "ERR");
assert.ok(Sky.statusLine(err).startsWith("Error · "));

const live = liveSnapshot();
assert.strictEqual(Sky.barLabel(live), "");
assert.strictEqual(Sky.barMode(live), "live");
assert.strictEqual(Sky.showFailChip(live), true);
assert.strictEqual(Sky.failCount(live), 1);
assert.strictEqual(Sky.summaryLine(live), "2 · 1 failed · partial (1/2 billed)");
assert.ok(Sky.windowLine(live).indexOf("Last night") >= 0);
assert.ok(Sky.windowLine(live).indexOf("America/Los_Angeles") >= 0);

const unread = liveSnapshot({
  present: true,
  ok: false,
  read_status: "unread",
  runs: [],
  summary: { runs: 0, failed: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" },
  error: "jobs.json is not a list or object"
});
assert.strictEqual(Sky.barMode(unread), "err");
assert.strictEqual(Sky.barLabel(unread), "ERR");
assert.strictEqual(Sky.showFailChip(unread), false);

const stale = Sky.markStale(live, "probe failed");
assert.strictEqual(Sky.barLabel(stale), "STALE");
assert.strictEqual(stale.busy, false);
assert.strictEqual(Sky.statusLine(stale), "Stale · last probe failed");
assert.strictEqual(Sky.showFailChip(stale), true);

assert.strictEqual(Sky.parseSnapshot("").error, "empty probe");
assert.strictEqual(Sky.barLabel(Sky.parseSnapshot("{not json")), "ERR");
assert.strictEqual(Sky.parseSnapshot('{"present":false}').demo, true);

const mergedStale = Sky.mergeProbe(live, "");
assert.strictEqual(Sky.barLabel(mergedStale), "STALE");
assert.strictEqual(mergedStale.summary.runs, 2);

const kept = Sky.mergeProbe(mergedStale, "");
assert.strictEqual(kept.summary.runs, 2);
assert.strictEqual(Sky.barLabel(kept), "STALE");

const fromDemoToErr = Sky.mergeProbe(Sky.demoSnapshot(), "");
assert.strictEqual(Sky.barLabel(fromDemoToErr), "ERR");

assert.strictEqual(Sky.runStatus({ status: null }), "unknown");
assert.strictEqual(Sky.runStatus({ status: "completed" }), "completed");
assert.strictEqual(Sky.runStatus({ status: "timeout" }), "unknown");
assert.notStrictEqual(Sky.runStatus({ status: null }), "completed");

assert.strictEqual(
  Sky.runHeading({ name: "Kid ping", profile: "kid" }, 2),
  "[kid] Kid ping"
);
assert.strictEqual(
  Sky.runHeading({ name: "Kid ping", profile: "kid" }, 1),
  "Kid ping"
);

const demoStars = Sky.demoStars();
assert.ok(demoStars.length >= 7);
assert.ok(demoStars.every((s) => s.kind === "dim"));

const idle = Sky.starsFromSnapshot(liveSnapshot({
  runs: [],
  summary: { runs: 0, failed: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" }
}));
assert.ok(idle.length >= 5);
assert.ok(idle.every((s) => s.kind === "dim"));

const stars = Sky.starsFromSnapshot(live);
assert.strictEqual(stars.length, 2);
const kinds = stars.map((s) => s.kind).sort();
assert.ok(kinds.indexOf("fail") >= 0 && kinds.indexOf("ok") >= 0);
const sized = Sky.starsFromSnapshot(liveSnapshot({
  runs: [
    { id: "cheap", status: "completed", usd: 0.01 },
    { id: "dear", status: "completed", usd: 1.0 },
    { id: "unknown-cost", status: "failed", usd: null }
  ]
}));
const byId = Object.fromEntries(sized.map((s) => [s.id, s]));
assert.ok(byId.dear.size > byId.cheap.size, "star size scales with recorded USD");
assert.strictEqual(byId["unknown-cost"].size, Sky.EQUAL_SIZE);
assert.strictEqual(byId["unknown-cost"].kind, "fail");

const hung = Sky.starKind("running");
assert.strictEqual(hung, "run");
assert.strictEqual(Sky.starKind("claimed"), "run");
assert.strictEqual(Sky.starKind("unknown"), "fail");

assert.strictEqual(Sky.formatCost({ usd: 0.02, estimatedUsd: 0.04 }), "$0.0200 actual · ~$0.0400 est");
assert.strictEqual(Sky.formatCost({ tokens: 100 }), "");
assert.strictEqual(Sky.formatCost({ estimatedUsd: 1.5 }), "~$1.50");

const complete = liveSnapshot({
  summary: { runs: 2, failed: 0, running: 0, usd: 0.03, usd_billed: 2, cost_coverage: "complete" }
});
assert.ok(Sky.summaryLine(complete).indexOf("$0.0300") >= 0);
assert.ok(Sky.summaryLine(complete).indexOf("partial") < 0);

const quietLive = liveSnapshot({
  runs: [],
  summary: { runs: 0, failed: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" }
});
assert.ok(Sky.statusLine(quietLive).indexOf("quiet") >= 0);
assert.strictEqual(Sky.barLabel(quietLive), "");

assert.ok(!src.includes("pgrep"));
assert.strictEqual(Sky.POLL_MS, 8000);

console.log("ok - ConstellationLogic helpers");
