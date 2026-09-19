.pragma library

// Cron Constellation helpers. Cost is never estimated here: USD is shown
// only when Hermes stored actual_cost_usd (labeled) or estimated_cost_usd
// (labeled ~$). Partial nights never render a bare dollar total.

var POLL_MS = 8000
var FRAME_MS = 80
var EQUAL_SIZE = 0.42
var MIN_SIZE = 0.28
var MAX_SIZE = 1.0

var DEMO_LAYOUT = [
  { x: 0.18, y: 0.58 },
  { x: 0.32, y: 0.34 },
  { x: 0.48, y: 0.46 },
  { x: 0.62, y: 0.26 },
  { x: 0.78, y: 0.40 },
  { x: 0.22, y: 0.22 },
  { x: 0.86, y: 0.68 },
  { x: 0.68, y: 0.78 },
  { x: 0.42, y: 0.80 },
  { x: 0.90, y: 0.28 },
  { x: 0.12, y: 0.44 }
]

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

function number(value) {
  var n = Number(value)
  return isFinite(n) ? n : 0
}

function emptyTotals() {
  return {
    runs: 0,
    failed: 0,
    running: 0,
    tokens: null,
    usd: null,
    usd_billed: 0,
    cost_coverage: "none"
  }
}

function emptyWindow() {
  return {
    start: "",
    end: "",
    tz: "",
    label: "Last night"
  }
}

function demoSnapshot() {
  return {
    present: false,
    demo: true,
    ok: true,
    busy: false,
    error: "",
    stale: false,
    home: "",
    read_status: "ok",
    window: emptyWindow(),
    summary: emptyTotals(),
    runs: [],
    homes: [],
    errors: [],
    source: "disk",
    profileCount: 0
  }
}

function errorSnapshot(message) {
  var snap = demoSnapshot()
  snap.demo = false
  snap.ok = false
  snap.error = message || "probe failed"
  snap.read_status = "unread"
  snap.errors = [{ kind: "probe", error: snap.error }]
  return snap
}

function copySnapshot(snapshot) {
  var next = demoSnapshot()
  if (!snapshot || typeof snapshot !== "object")
    return next
  var key
  for (key in snapshot) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key))
      next[key] = snapshot[key]
  }
  if (!Array.isArray(next.runs))
    next.runs = []
  if (!Array.isArray(next.homes))
    next.homes = []
  if (!Array.isArray(next.errors))
    next.errors = []
  if (!next.summary || typeof next.summary !== "object")
    next.summary = emptyTotals()
  if (!next.window || typeof next.window !== "object")
    next.window = emptyWindow()
  return next
}

function markStale(snapshot, message) {
  var next = copySnapshot(snapshot)
  next.stale = true
  next.busy = false
  next.error = message || next.error || "probe failed"
  return next
}

function parseSnapshot(text) {
  var raw = String(text || "").trim()
  if (raw === "")
    return errorSnapshot("empty probe")
  try {
    var parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object")
      return errorSnapshot("invalid snapshot")
    parsed = copySnapshot(parsed)
    parsed.error = parsed.error ? String(parsed.error) : ""
    parsed.stale = parsed.stale === true
    parsed.busy = parsed.busy === true
    parsed.profileCount = number(parsed.profileCount)
    if (parsed.error && parsed.present !== true) {
      parsed.demo = false
      parsed.present = false
      parsed.ok = false
      parsed.busy = false
      return parsed
    }
    if (parsed.present !== true) {
      var demo = demoSnapshot()
      demo.home = parsed.home || ""
      demo.window = parsed.window || demo.window
      return demo
    }
    parsed.demo = false
    parsed.present = true
    parsed.ok = parsed.ok !== false
    return parsed
  } catch (e) {
    return errorSnapshot("invalid snapshot")
  }
}

function mergeProbe(current, text) {
  var next = parseSnapshot(text)
  var live = current && current.present === true && current.stale !== true
  if (next && next.present === true)
    return next
  if (next && next.demo === true && !next.error)
    return next
  if (live)
    return markStale(current, next && next.error ? next.error : "probe failed")
  if (current && current.stale === true && current.present === true)
    return current
  if (current && current.error && current.present !== true)
    return current
  return next && next.error ? next : errorSnapshot("probe failed")
}

function barMode(snapshot) {
  if (!snapshot)
    return "demo"
  if (snapshot.stale === true)
    return "stale"
  if (snapshot.error && snapshot.present !== true)
    return "err"
  if (snapshot.present === true && snapshot.ok === false && snapshot.read_status === "unread")
    return "err"
  if (snapshot.error && snapshot.present !== true)
    return "err"
  if (snapshot.present !== true)
    return "demo"
  if (snapshot.ok === false && (!snapshot.runs || snapshot.runs.length === 0) && snapshot.read_status === "unread")
    return "err"
  return "live"
}

function barLabel(snapshot) {
  var mode = barMode(snapshot)
  if (mode === "err")
    return "ERR"
  if (mode === "stale")
    return "STALE"
  if (mode === "demo")
    return "DEMO"
  return ""
}

function failCount(snapshot) {
  if (!snapshot || !snapshot.summary)
    return 0
  return Math.max(0, Math.round(number(snapshot.summary.failed)))
}

function showFailChip(snapshot) {
  var mode = barMode(snapshot)
  if (mode === "demo" || mode === "err")
    return false
  return failCount(snapshot) > 0
}

function hashString(text) {
  var s = String(text || "")
  var h = 2166136261
  var i
  for (i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function unitFromHash(h, shift) {
  return ((h >>> shift) & 0xffff) / 0xffff
}

function starKind(status) {
  var s = String(status || "").toLowerCase()
  if (s === "completed")
    return "ok"
  if (s === "running" || s === "claimed")
    return "run"
  return "fail"
}

function recordedUsd(run) {
  if (!run)
    return null
  if (typeof run.usd === "number" && isFinite(run.usd) && run.usd > 0)
    return run.usd
  return null
}

function estimatedUsd(run) {
  if (!run)
    return null
  if (typeof run.estimatedUsd === "number" && isFinite(run.estimatedUsd) && run.estimatedUsd > 0)
    return run.estimatedUsd
  return null
}

function sizeUsd(run) {
  var actual = recordedUsd(run)
  if (actual != null)
    return actual
  return estimatedUsd(run)
}

function maxSizeUsd(runs) {
  var max = 0
  var i
  var list = runs || []
  for (i = 0; i < list.length; i++) {
    var usd = sizeUsd(list[i])
    if (usd != null && usd > max)
      max = usd
  }
  return max
}

function starSize(run, maxUsd) {
  var usd = sizeUsd(run)
  if (usd == null || usd <= 0 || !(maxUsd > 0))
    return EQUAL_SIZE
  var t = Math.log(usd + 1) / Math.log(maxUsd + 1)
  return MIN_SIZE + clamp(t, 0, 1) * (MAX_SIZE - MIN_SIZE)
}

function layoutStar(id, index) {
  var h = hashString(String(id || "star") + ":" + index)
  return {
    x: 0.10 + unitFromHash(h, 0) * 0.80,
    y: 0.16 + unitFromHash(h, 16) * 0.68
  }
}

function demoStars() {
  var stars = []
  var i
  for (i = 0; i < DEMO_LAYOUT.length; i++) {
    stars.push({
      id: "demo-" + i,
      x: DEMO_LAYOUT[i].x,
      y: DEMO_LAYOUT[i].y,
      size: i % 3 === 0 ? 0.38 : 0.28,
      kind: "dim",
      twinkle: 0.35 + (i % 5) * 0.08
    })
  }
  return stars
}

function idleStars() {
  var stars = []
  var i
  for (i = 0; i < 7; i++) {
    stars.push({
      id: "idle-" + i,
      x: DEMO_LAYOUT[i].x,
      y: DEMO_LAYOUT[i].y,
      size: 0.24,
      kind: "dim",
      twinkle: 0.22 + (i % 4) * 0.06
    })
  }
  return stars
}

function starsFromSnapshot(snapshot) {
  var mode = barMode(snapshot)
  if (mode === "demo" || mode === "err")
    return demoStars()
  var runs = snapshot && Array.isArray(snapshot.runs) ? snapshot.runs : []
  if (!runs.length)
    return idleStars()
  var maxUsd = maxSizeUsd(runs)
  var stars = []
  var i
  for (i = 0; i < runs.length; i++) {
    var run = runs[i] || {}
    var pos = layoutStar(run.id || run.job_id || run.name, i)
    stars.push({
      id: String(run.id || run.job_id || i),
      x: pos.x,
      y: pos.y,
      size: starSize(run, maxUsd),
      kind: starKind(run.status),
      twinkle: 0.45 + (hashString(run.id || i) % 40) / 100
    })
  }
  return stars
}

function formatTokens(value) {
  if (value == null || value === "")
    return ""
  var n = Math.round(number(value))
  if (n <= 0)
    return ""
  if (n < 1000)
    return String(n)
  if (n < 1000000) {
    var k = n / 1000
    return (k >= 10 ? k.toFixed(0) : k.toFixed(1)) + "k"
  }
  var m = n / 1000000
  return (m >= 10 ? m.toFixed(0) : m.toFixed(1)) + "m"
}

function formatUsd(amount, estimated) {
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0)
    return ""
  var digits = amount >= 0.1 ? 2 : 4
  return (estimated ? "~$" : "$") + amount.toFixed(digits)
}

function formatCost(run) {
  if (!run)
    return ""
  var actual = formatUsd(recordedUsd(run), false)
  var estimated = formatUsd(estimatedUsd(run), true)
  if (actual !== "" && estimated !== "")
    return actual + " actual · " + estimated + " est"
  if (actual !== "")
    return actual
  return estimated
}

function costLine(snapshot) {
  if (!snapshot || !snapshot.summary)
    return "cost unknown"
  var summary = snapshot.summary
  var n = Math.round(number(summary.runs))
  var billed = Math.round(number(summary.usd_billed))
  if (summary.cost_coverage === "complete" && typeof summary.usd === "number")
    return formatUsd(summary.usd, false)
  if (summary.cost_coverage === "partial")
    return "partial (" + billed + "/" + n + " billed)"
  return "cost unknown"
}

function summaryLine(snapshot) {
  if (!snapshot || snapshot.present !== true)
    return ""
  var summary = snapshot.summary || emptyTotals()
  var n = Math.round(number(summary.runs))
  var failed = Math.round(number(summary.failed))
  var bits = [String(n), failed + " failed"]
  var running = Math.round(number(summary.running))
  if (running > 0)
    bits.push(running + " running")
  bits.push(costLine(snapshot))
  return bits.join(" · ")
}

function windowLine(snapshot) {
  if (!snapshot || !snapshot.window)
    return ""
  var win = snapshot.window
  var label = String(win.label || "Last night")
  var tz = String(win.tz || "").trim()
  var start = formatClock(win.start)
  var end = formatClock(win.end)
  var bits = [label]
  if (start && end)
    bits.push(start + " → " + end)
  if (tz)
    bits.push(tz)
  return bits.join(" · ")
}

function formatClock(iso) {
  if (!iso)
    return ""
  var d = new Date(iso)
  if (isNaN(d.getTime())) {
    var m = String(iso).match(/T(\d{2}:\d{2})/)
    return m ? m[1] : ""
  }
  var hh = ("0" + d.getHours()).slice(-2)
  var mm = ("0" + d.getMinutes()).slice(-2)
  return hh + ":" + mm
}

function runStatus(run) {
  if (!run)
    return "unknown"
  var status = String(run.status || "").toLowerCase()
  if (status === "completed")
    return "completed"
  if (status === "failed")
    return "failed"
  if (status === "running")
    return "running"
  if (status === "claimed")
    return "claimed"
  if (status === "unknown")
    return "unknown"
  if (run.error)
    return "failed"
  return "unknown"
}

function runHeading(run, profileCount) {
  var name = String((run && (run.name || run.job_id)) || "cron")
  if (number(profileCount) > 1 && run && run.profile)
    return "[" + String(run.profile) + "] " + name
  return name
}

function runMeta(run) {
  var bits = []
  var when = formatClock(run && (run.started_at || run.finished_at))
  if (when)
    bits.push(when)
  bits.push(runStatus(run))
  var tokens = formatTokens(run && run.tokens)
  if (tokens)
    bits.push(tokens + " tok")
  var cost = formatCost(run)
  if (cost)
    bits.push(cost)
  return bits.join(" · ")
}

function statusLine(snapshot) {
  if (!snapshot)
    return "Demo idle · ~/.hermes not found"
  var mode = barMode(snapshot)
  if (mode === "stale")
    return "Stale · last probe failed"
  if (mode === "err")
    return "Error · " + (snapshot.error || "could not read cron storage")
  if (mode === "demo")
    return "Demo idle · no Hermes cron home"
  var summary = snapshot.summary || emptyTotals()
  var n = Math.round(number(summary.runs))
  var failed = Math.round(number(summary.failed))
  var running = Math.round(number(summary.running))
  var label = snapshot.window && snapshot.window.label ? snapshot.window.label : "Last night"
  if (n === 0)
    return "Idle · " + label.toLowerCase() + " was quiet"
  if (failed > 0 && running > 0)
    return label + " · " + failed + " failed · " + running + " still running"
  if (failed > 0)
    return label + " · " + failed + " failed"
  if (running > 0)
    return label + " · " + running + " still running"
  return label + " · " + n + " run" + (n === 1 ? "" : "s")
}

function detectTz() {
  try {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat)
      return String(Intl.DateTimeFormat().resolvedOptions().timeZone || "")
  } catch (e) {}
  return ""
}
