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
    read_status: "ok",
    runs: [
      { id: "ok1", name: "Briefing", status: "completed", started_at: "2026-09-18T22:05:00-07:00", tokens: 120, usd: 0.02 },
      { id: "bad1", name: "Ping", status: "failed", started_at: "2026-09-18T23:10:00-07:00", tokens: 3, usd: null, profile: "kid" }
    ],
    summary: { runs: 2, failed: 1, unknown: 0, running: 0, tokens: 123, usd: null, usd_billed: 1, cost_coverage: "partial" },
    window: { start: "2026-09-18T18:00:00-07:00", end: "2026-09-19T08:00:00-07:00", tz: "America/Los_Angeles", label: "Last night" },
    profileCount: 2,
    homes: ["default", "kid"]
  }));
  return Object.assign(snap, overrides || {});
}

assert.strictEqual(Sky.barLabel(Sky.demoSnapshot()), "DEMO");
assert.strictEqual(Sky.barMode(Sky.demoSnapshot()), "demo");
assert.ok(Sky.statusLine(Sky.demoSnapshot()).toLowerCase().indexOf("demo") >= 0);

const err = Sky.errorSnapshot("unreadable executions.db");
assert.strictEqual(Sky.barLabel(err), "ERR");
assert.ok(Sky.statusLine(err).startsWith("Error · "));

const live = liveSnapshot();
assert.strictEqual(Sky.barLabel(live), "");
assert.strictEqual(Sky.barMode(live), "live");
assert.strictEqual(Sky.showFailChip(live), true);
assert.strictEqual(Sky.failCount(live), 1);
assert.strictEqual(Sky.summaryLine(live), "2 · 1 failed · partial (1/2 billed) · 2 profiles");
assert.ok(Sky.windowLine(live).indexOf("Last night") >= 0);
assert.ok(Sky.windowLine(live).indexOf("America/Los_Angeles") >= 0);

// P0.2 — clock digits are the probe window, not Date#getHours() on a UTC host.
assert.strictEqual(Sky.formatClock("2026-09-18T18:00:00-07:00"), "18:00");
assert.strictEqual(Sky.formatClock("2026-09-19T08:00:00-07:00"), "08:00");
assert.strictEqual(Sky.formatClock("2026-09-18T22:05:00-07:00"), "22:05");
assert.strictEqual(
  Sky.windowLine(live),
  "Last night · 18:00 → 08:00 · America/Los_Angeles"
);
assert.ok(Sky.runMeta(live.runs[0]).indexOf("22:05") >= 0);

const unread = liveSnapshot({
  present: true,
  ok: false,
  read_status: "unread",
  runs: [],
  summary: { runs: 0, failed: 0, unknown: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" },
  error: "jobs.json is not a list or object"
});
assert.strictEqual(Sky.barMode(unread), "err");
assert.strictEqual(Sky.barLabel(unread), "ERR");
assert.strictEqual(Sky.showFailChip(unread), false);
assert.strictEqual(Sky.emptyNightCopy(unread), "");
assert.ok(Sky.headerCaption(unread).indexOf("Error") === 0);
assert.ok(Sky.statusLine(unread).indexOf("Nothing ran") < 0);
assert.ok(Sky.statusLine(unread).toLowerCase().indexOf("quiet") < 0);

const stale = Sky.markStale(live, "probe failed");
assert.strictEqual(Sky.barLabel(stale), "STALE");
assert.strictEqual(stale.busy, false);
assert.strictEqual(Sky.statusLine(stale), "Stale · last probe failed");
assert.strictEqual(Sky.showFailChip(stale), true);
assert.ok(Sky.headerCaption(stale).indexOf("Stale") === 0);

assert.strictEqual(Sky.parseSnapshot("").error, "empty probe");
assert.strictEqual(Sky.barLabel(Sky.parseSnapshot("{not json")), "ERR");
assert.strictEqual(Sky.parseSnapshot('{"present":false}').demo, true);

// Missing ok is not a live quiet night.
const omittedOk = Sky.parseSnapshot(JSON.stringify({
  present: true,
  runs: [],
  read_status: "ok"
}));
assert.strictEqual(omittedOk.ok, false);
assert.strictEqual(Sky.barMode(omittedOk), "err");
assert.strictEqual(Sky.barLabel(omittedOk), "ERR");
assert.strictEqual(Sky.emptyNightCopy(omittedOk), "");

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
  summary: { runs: 0, failed: 0, unknown: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" }
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

// P0.3 — estimates never size the sky. Caption stays "cost unknown".
const estimatedOnly = Sky.starsFromSnapshot(liveSnapshot({
  runs: [
    { id: "cheap", status: "completed", usd: null, estimatedUsd: 0.01 },
    { id: "dear", status: "completed", usd: null, estimatedUsd: 2.0 },
    { id: "unknown", status: "completed", usd: null }
  ],
  summary: { runs: 3, failed: 0, unknown: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" }
}));
const estById = Object.fromEntries(estimatedOnly.map((s) => [s.id, s]));
assert.strictEqual(estById.cheap.size, Sky.EQUAL_SIZE);
assert.strictEqual(estById.dear.size, Sky.EQUAL_SIZE);
assert.strictEqual(estById.unknown.size, Sky.EQUAL_SIZE);
assert.strictEqual(Sky.sizeUsd({ usd: null, estimatedUsd: 2.0 }), null);
assert.strictEqual(Sky.costLine(liveSnapshot({
  summary: { runs: 3, failed: 0, unknown: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" }
})), "cost unknown");

const hung = Sky.starKind("running");
assert.strictEqual(hung, "run");
assert.strictEqual(Sky.starKind("claimed"), "run");
assert.strictEqual(Sky.starKind("unknown"), "unknown");
assert.strictEqual(Sky.starKind(null), "unknown");
assert.strictEqual(Sky.starKind(""), "unknown");
assert.strictEqual(Sky.starKind("timeout"), "unknown");
assert.strictEqual(Sky.starKind("failed"), "fail");
assert.strictEqual(Sky.starKind("completed"), "ok");

assert.strictEqual(Sky.formatCost({ usd: 0.02, estimatedUsd: 0.04 }), "$0.0200 actual · ~$0.0400 est");
assert.strictEqual(Sky.formatCost({ tokens: 100 }), "");
assert.strictEqual(Sky.formatCost({ estimatedUsd: 1.5 }), "~$1.50");

const complete = liveSnapshot({
  summary: { runs: 2, failed: 0, unknown: 0, running: 0, usd: 0.03, usd_billed: 2, cost_coverage: "complete" }
});
assert.ok(Sky.summaryLine(complete).indexOf("$0.0300") >= 0);
assert.ok(Sky.summaryLine(complete).indexOf("partial") < 0);

const quietLive = liveSnapshot({
  runs: [],
  summary: { runs: 0, failed: 0, unknown: 0, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" },
  profileCount: 1
});
assert.ok(Sky.statusLine(quietLive).indexOf("quiet") >= 0);
assert.strictEqual(Sky.barLabel(quietLive), "");
assert.strictEqual(Sky.isQuietEmpty(quietLive), true);
assert.strictEqual(Sky.emptyNightCopy(quietLive), "Nothing ran in this overnight window.");
assert.ok(Sky.headerCaption(quietLive).indexOf("Last night") === 0);

// P0.1 — parent-ok + kid unread is partial, never unmarked live-green.
const partial = liveSnapshot({
  present: true,
  ok: false,
  read_status: "partial",
  error: "jobs.json is not a list or object",
  errors: [{ kind: "jobs.json", home: "kid", error: "jobs.json is not a list or object" }],
  runs: [{ id: "parent", name: "Parent", status: "completed", usd: 0.01 }],
  summary: { runs: 1, failed: 0, unknown: 0, running: 0, usd: 0.01, usd_billed: 1, cost_coverage: "complete" },
  profileCount: 2,
  homes: ["default", "kid"]
});
assert.strictEqual(Sky.barMode(partial), "err");
assert.strictEqual(Sky.barLabel(partial), "ERR");
assert.notStrictEqual(Sky.barLabel(partial), "");
assert.ok(Sky.headerCaption(partial).indexOf("Error") === 0);
assert.strictEqual(Sky.emptyNightCopy(partial), "");
assert.strictEqual(Sky.isQuietEmpty(partial), false);

const errorsOnly = liveSnapshot({
  present: true,
  ok: true,
  read_status: "ok",
  error: "",
  errors: [{ kind: "usage_audit.jsonl", error: "invalid jsonl" }],
  runs: [{ id: "ok1", status: "completed" }]
});
assert.strictEqual(Sky.barMode(errorsOnly), "err");
assert.strictEqual(Sky.barLabel(errorsOnly), "ERR");

// P0.4 — unknown is not failed; running has its own chip.
const auditGhost = liveSnapshot({
  runs: [{ id: "ghost", status: null, tokens: 9, usd: null }],
  summary: { runs: 1, failed: 0, unknown: 1, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" },
  profileCount: 1
});
assert.strictEqual(Sky.starKind(null), "unknown");
assert.strictEqual(Sky.starsFromSnapshot(auditGhost)[0].kind, "unknown");
assert.strictEqual(Sky.failCount(auditGhost), 0);
assert.strictEqual(Sky.unknownCount(auditGhost), 1);
assert.strictEqual(Sky.showFailChip(auditGhost), false);
assert.ok(Sky.summaryLine(auditGhost).indexOf("1 unknown") >= 0);
assert.ok(Sky.statusLine(auditGhost).indexOf("unknown") >= 0);
assert.strictEqual(Sky.headerTone(auditGhost), "unknown");

const timeoutNight = liveSnapshot({
  runs: [{ id: "to", status: "unknown" }],
  summary: { runs: 1, failed: 0, unknown: 1, running: 0, usd: null, usd_billed: 0, cost_coverage: "none" },
  profileCount: 1
});
assert.strictEqual(Sky.showFailChip(timeoutNight), false);
assert.strictEqual(Sky.starKind("unknown"), "unknown");

const hungNight = liveSnapshot({
  runs: [{ id: "run1", status: "running" }],
  summary: { runs: 1, failed: 0, unknown: 0, running: 1, usd: null, usd_billed: 0, cost_coverage: "none" },
  profileCount: 1
});
assert.strictEqual(Sky.showFailChip(hungNight), false);
assert.strictEqual(Sky.showRunChip(hungNight), true);
assert.strictEqual(Sky.runningCount(hungNight), 1);
assert.ok(Sky.statusLine(hungNight).indexOf("still running") >= 0);
assert.strictEqual(Sky.headerTone(hungNight), "run");

assert.ok(!src.includes("pgrep"));
assert.ok(!src.includes("getHours"));
assert.ok(!src.includes("getMinutes"));
assert.strictEqual(Sky.POLL_MS, 8000);

console.log("ok - ConstellationLogic helpers");
