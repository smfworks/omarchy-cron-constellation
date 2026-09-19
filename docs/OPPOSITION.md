# Opposition: do not trust Cron Constellation for overnight ops yet

Adversarial review of `smfworks/omarchy-cron-constellation` at `1f0ad76`
(`smf.cron-constellation` v0.1.0, plugin #1). No product fixes in this PR.
Evidence is from `probe.py`, `ConstellationLogic.js`, `BarWidget.qml`,
`Panel.qml`, `manifest.json`, `README.md`, `tests/test_probe.py`, and
`tests/test_constellation_logic.js`.

This widget claims to match [SMF Cron Night](https://github.com/smfworks/smf-cron-night)
honesty rules and to be the companion of
[Neural Pulse](https://github.com/smfworks/omarchy-neural-pulse). Many of those
fixes *are* in this tree (see §7). The leftover lies are on the **face**: a
screenshot of the starfield will still be believed when the ledger was unread,
the clock is in the wrong zone, or star size is an estimate.

Method: assume a user screenshots the bar starfield (and maybe the glass panel)
and treats green / equal size / no chip as “last night was fine.” Argue against
that.

---

## Cross-check — fixed there, still broken here

From `smf-cron-night` `docs/OPPOSITION.md` (Honest night + Round 2) and
`omarchy-neural-pulse` `docs/OPPOSITION.md` (Honest pulse).

| Lesson | Cron Night / Neural Pulse | Still in Constellation? |
|--------|---------------------------|-------------------------|
| Unread ≠ quiet | Disk I/O → `ok: false`; pane ErrorState | **Partial.** Probe records `errors[]`. Bar is **ERR** only when *no* windowed runs. One readable home + one corrupt `jobs.json` → unmarked live **green** sky (`barMode` → `"live"`). Panel prefers `windowText` over `statusLine`, then “Nothing ran in this overnight window.” |
| 18:00 window moves | `current >= 18:00` → tonight | **Closed** in `overnight_window` (tested 18:00 / 18:30 / 23:00). Leftover: `finished_at` at 18:01 still pulls a 09:00 daytime job in. |
| Desktop TZ ≠ serve TZ | Desktop sends `?tz=` / `--tz` | Probe gets `Intl` via `Panel.qml` `detectTz()`. **Face ignores it:** `formatClock` uses `Date#getHours()` in the Quickshell/JS zone. This agent image is UTC: `2026-09-18T18:00:00-07:00` renders **`01:00`**, labeled `America/Los_Angeles`. |
| Unknown ≠ completed | Sessions / unaudited md → `unknown` | Probe yes. Face: `starKind(null\|unknown\|timeout)` → **`"fail"`** (red star) while `summarize_runs` counts `status is None` as **0 failed**. Fail chip also treats `unknown` as failed (`_TERMINAL_FAILED`). |
| Partial USD / no invented rate | Omit bare `$` unless every run billed | Summary line yes (`costLine`). **Star size no:** `sizeUsd` falls back to `estimatedUsd`. Header “cost unknown”, stars at 0.28 vs 1.0. |
| Hung before 18:00 visible | Filter keeps unfinished `running`/`claimed` | Kept — including **weeks-old** hung rows and rows with **no** `started_at`. Cron Night added a **running chip**. This bar has **fail chip only**. Accent-colored “run” stars look like ok on a green theme. |
| Multi-home labeled, not silent | Header lists homes; rows badge `[profile]` | Rows badge when `profileCount > 1`. **Header never mentions profiles** (`summaryLine` is `n · f failed · cost`). README says it does. Union + 240-char snippets still leak. |
| `present` needs a real store | Neural Pulse: opened `state.db`, not a dir | Empty `~/.hermes` is DEMO. **`.env` or `config.yaml` alone** is a live quiet night (`_HOME_MARKERS`). |
| No `pgrep` / no WAL mtime | Honest pulse deleted both | Holds. |
| Theme, not hardcoded neon | Pulse uses `Color.accent` / `urgent` | **Regressed.** `starOk: Qt.rgba(0.38, 0.90, 0.58, 1)` in `BarWidget.qml` and `Panel.qml`. White cores on every star. |
| SQLite timeout | Pulse `timeout=1.5` | **Missing.** `sqlite3.connect(...)` with no timeout. `refresh()` no-ops while `probe.running`. Hung probe → frozen “live” sky, not STALE. |
| Dual aggregator | Cron Night REST vs RPC still split | **Closed.** One `probe.py`. JS does not re-window. This is the main honesty upgrade. |

Pytest: `python3 -m pytest tests -q` → **51 passed** in 0.26s (after `pip install pytest`).
`node tests/test_constellation_logic.js` → `ok - ConstellationLogic helpers`.
Those 51 + the Node asserts do **not** cover the trust breakers below. No
`.github` workflow, so merge green is not CI green.

---

## 1. Executive opposition

I would not trust this starfield for a Spark morning. It can paint an
**unmarked green sky** when a sibling Hermes profile’s `jobs.json` is unread
and the default home only has `last_status=ok`. The glass panel then hides
`statusLine` behind a window caption whose hours are **JS-local, not `--tz`**
— on a UTC Omarchy shell that is `Last night · 01:00 → 15:00 · America/Los_Angeles`.
Star **size** is `estimated_cost_usd` whenever `usd` is missing, while the
caption says `cost unknown`. A clean `usage_audit` row (`status is None`) is a
**red** star and `0 failed` at the same time. Hung work has no bar chip.
`python3` walking every cron home every 8s plus an 80ms Canvas is a mood light
that still says “all quiet” when the probe is stuck or the home was an `.env`
file. Do not screenshot this and call the night fine.

---

## 2. P0 — trust breakers (must-fix)

### P0.1 Stars look “all green” when unread, mixed-home, or last_run-ok

The bar is screenshot-first. `BarWidget.qml` `paintSky` colors `kind === "ok"`
with hardcoded mint. `ConstellationLogic.js` `barMode` only returns `"err"` for
unread when there are **no** runs (or `present !== true`):

```javascript
if (snapshot.present === true && snapshot.ok === false && snapshot.read_status === "unread")
  return "err"
// ...
return "live"
```

`probe.py` `night_payload` sets `read_status = "partial" if windowed else "unread"`
when `errors` is non-empty. Partial **is live**.

**Reproduced** (default home + `profiles/kid`):

| Input | Probe | Face |
|-------|--------|------|
| Parent `jobs.json` `last_run_at=2026-09-18T22:00-07:00`, `last_status=ok`. Kid `jobs.json` = `{not json`. | `ok: false`, `read_status: "partial"`, `homes: [default, kid]`, one run `Parent / completed`. | `barMode` **`live`**, `barLabel` `""`, `showFailChip` false, stars `['ok']`. Tooltip: `Last night · 1 run`. |
| Unread empty (`ok: false`, `read_status: "unread"`, `runs: []`) | `wrap_payload` still `present: true` | Bar **ERR**. Panel (`Panel.qml` ~179, ~286): `windowText` wins over `statusLine`; `hermesPresent && runs.length === 0` → **“Nothing ran in this overnight window.”** |
| Live `ok: true`, `runs: []` (home has `config.yaml` / empty `cron/`) | `read_status: "ok"` | Unmarked dim `idleStars`, `Idle · last night was quiet`. Fail chip off. Same face as “could not see kid cron.” |
| STALE after a green night | `markStale` keeps runs | `STALE` overlay on the **same green stars**. Panel header still shows the last window, not `Stale · last probe failed`. |

`last_run_at` is only synthesized when that job has no other history
(`collect_home_runs`). That is the Cron Night R2 rule — and it is still a
**green extra night** when the only pointer is `last_status=ok`. Example in
`test_night_payload_labels_profiles_when_unioning_homes`: Parent briefing is
`completed` from that pointer.

`parseSnapshot` also coerces missing `ok` to success (`parsed.ok = parsed.ok !== false`).
`{"present": true, "runs": []}` with `ok` omitted → live quiet.

Neural Pulse Honest pulse: **any** `snapshot.error` is `err` on the bar. This
port kept the glyphs and then punched a live hole for partial.

### P0.2 Window face ≠ probe TZ (18:00 hours lie on the screenshot)

`overnight_window` itself is the Honest-night function. Tests at 18:00 / 18:30 /
23:00 and UTC-vs-LA **bounds** pass. The screenshot does not show bounds
objects. It shows `windowLine` → `formatClock`:

```javascript
var d = new Date(iso)
var hh = ("0" + d.getHours()).slice(-2)  // JS host zone, not win.tz
```

This review host: `Intl` TZ = `UTC`, `TZ` unset.

| ISO in payload (probe `--tz America/Los_Angeles`) | `formatClock` | `windowLine` |
|---------------------------------------------------|---------------|--------------|
| `2026-09-18T18:00:00-07:00` | **`01:00`** | `Last night · 01:00 → 15:00 · America/Los_Angeles` |
| `2026-09-19T08:00:00-07:00` | **`15:00`** | (same) |
| Run `started_at` `2026-09-18T22:05:00-07:00` | **`05:05`** | `runMeta` time is UTC |

`tests/test_constellation_logic.js` only asserts `windowLine` contains
`Last night` and `America/Los_Angeles` — **not the digits**. A UTC systemd
Omarchy shell (the Cron Night P0.3 setup) plus a correct `--tz` probe is
exactly this: filter is LA, face is UTC. The operator who believes the
screenshot thinks last night was 01:00–15:00.

Leftovers of the window *filter* (Cron Night R2):

- `filter_runs_in_window` keeps a run if **either** `started_at` **or**
  `finished_at` is in-window. Reproduced: started `09:00`, finished `18:01` →
  `day_spill` included as overnight.
- Exclusive end `dt < 08:00:00` still drops an 08:00:00 tick (`test_filter_runs_keeps_only_overnight_attempts`).
- `_hung_into_window`: `started is None` → **always keep**; `started < end` with
  no age cap. Reproduced: `ancient` started `2026-08-01` still `running`, and
  `nots` with no timestamps, both kept in the Sep 18–19 window.

`detectTz()` empty (no `Intl`) → `Process.command` omits `--tz` →
`resolve_tz(None)` is **probe-process** local (documented). The face still uses
JS local. Two zones, one starfield.

### P0.3 Cost size encoding lies (without inventing a rate)

README: “star size ∝ recorded cost (equal size when cost is unknown).”
`sizeUsd` in `ConstellationLogic.js`:

```javascript
function sizeUsd(run) {
  var actual = recordedUsd(run)   // usd > 0 only
  if (actual != null) return actual
  return estimatedUsd(run)        // estimatedUsd > 0
}
```

**Reproduced** (all `usd: null`, `cost_coverage: "none"` → caption `cost unknown`):

| Run | `estimatedUsd` | `starSize` |
|-----|----------------|------------|
| `cheap` | 0.01 | **0.287** |
| `dear` | 2.0 | **1.0** |
| `unknown` | — | 0.42 (`EQUAL_SIZE`) |

The screenshot says the dear job cost more. Hermes never stored a bill. Panel
`formatCost` would label `~$2.00`; the **bar has no ~$**. `summarize_runs`
correctly omits `usd` unless every in-window run has `usd` (Cron Night cheap
P0.5). The visual channel undoes it.

Other cost lies (same family as Cron Night P0.5, not redesigned):

- `normalize_cost` key `"total"` binds an unrelated total. Reproduced:
  `{"total": 2}` → `tokens=2`.
- 120s merge miss. Execution `unknown` at `21:00` with `finished_at=None` vs
  audit `ts` `2026-09-19T04:03:00.000Z` (21:03 PDT, 180s later) → **2 rows**
  `(None, 250 tokens)` + `(unknown, None)`. Tests cover the *finished_at*
  hit (`test_merge_matches_audit_to_finished_at_not_only_started`), not this miss.
- `$0` actual is treated as unknown size (`usd > 0`). Fine. Token-only 1M vs 10
  tok are equal size — documented, and still a “cheap night” screenshot if you
  believe size.
- `estimated_cost_usd` is copied onto `estimatedUsd` and shown as `~$` in the
  panel (`formatCost`). That is labeled. Star size is not.

### P0.4 Status face ≠ ledger (unknown, hung, audit ghost)

Probe status mapping *mostly* matches Honest night: missing/unmapped
`end_reason` → `unknown`; unaudited markdown without `(FAILED)` → `unknown`;
clean `usage_audit` omits status (does not paint `completed`). Tests cover
those. The **stars and chips** do not.

| Input | `run.status` | `starKind` / paint | `summarize_runs` / chip |
|-------|----------------|--------------------|-------------------------|
| Clean audit-only line (`error: null`) | `None` | **`fail` (red)** | `failed: 0`. Status line: `Last night · 1 run`. Summary: `1 · 0 failed · cost unknown`. |
| `end_reason=timeout` / `cancelled` | `unknown` | red fail | **`failed += 1`** (`_TERMINAL_FAILED`). Fail chip says “1” for a timeout. |
| `running` / `claimed` (incl. 17:00 spillover) | `running` | `run` = `Color.accent` | `running` counted; **`showFailChip` false**. No running chip (Cron Night has one). Unmarked bar. |
| `ok_silent` | `completed` (`_STATUS_COMPLETED`) | green ok | 0 failed. Scheduler-silent looks delivered. |
| `jobs.json` `last_status=ok` only | `completed` | green | Pointer, not a ledger row. |

`Panel.qml` header summary color is `failCount > 0 ? starFail : starOk`.
Audit-only night: **green caption + red star**. Timeout night: red caption +
red chip for non-failures. Hung night: green caption, accent star, no chip.

`starKind("timeout")` is `"fail"` because anything not `completed|running|claimed`
is fail — including raw strings if they ever skip `normalize_status`.
`runStatus({status:"timeout"})` is `"unknown"`. Two functions, two stories.

---

## 3. P1 — gaps / correctness

- **`.env` / `config.yaml` is enough to leave DEMO.**
  `_HOME_MARKERS = ("config.yaml", "cron", "state.db", ".env")`. Reproduced:
  `~/.hermes/.env` only → `present=true`, `demo=false`, `ok=true`, `runs=[]`
  (live quiet). Empty dir stays DEMO (`test_empty_home_is_demo`). Neural Pulse
  requires an opened `state.db`. Cron Night already flagged `.env` as a marker.
- **`usage_audit.jsonl` bad lines are skipped with no error.** Reproduced:
  `{bad\n` + a valid token line → `ok: true`, `errors: []`, one run
  `tokens=9`, `status=None` (red star, 0 failed). Same leftover as Cron Night.
- **No profile count / homes list on the panel header.** README: “the header
  notes how many profiles contributed.” `summaryLine` / `windowLine` never
  append `N profiles` or `homes[]`. Neural Pulse `headerTotalsLine` does.
  Kid-profile `error_snippet` (240 chars) still sits next to parent names.
- **QML / Omarchy contract leftovers** (same as pre-fix Neural Pulse):
  `closeForPopoutSwitch` is forwarded on `BarWidget.qml` but **not defined** on
  `Panel.qml` (relies on `qs.Ui.Panel`). No `ipcTarget` on the panel. `toggle()`
  never sets `centerHoverRevealSuppressed` true. No `preview.png`. README says
  `omarchy plugin validate .` and not `qmllint -I "$OMARCHY_PATH/shell" …`.
  `IpcHandler` first claimant per monitor wins.
- **Hardcoded mint + white cores.** `starOk` / header border / summary-ok color
  are `Qt.rgba(0.38, 0.90, 0.58, 1)`, not `Color.accent`. Every star gets a
  white highlight (`Qt.rgba(1,1,1,1)`). Light theme + small `Style.space(78)`
  slot: fail/ok/run collapse to sparkles. Honest pulse moved the wave to theme
  tokens; this widget reintroduced a cyberpunk sticker for “success.”
- **Polling / performance.** `POLL_MS = 8000` always, panel closed. `probe.py`
  (~1174 lines) walks `jobs.json`, `executions.db`, `usage_audit.jsonl`,
  **every** `cron/output/**/*.md`, and `state.db` LIMIT 500 — per home — with
  **no sqlite timeout**. `refresh()` returns if `probe.running` (no STALE).
  `FRAME_MS = 80` Canvas `requestPaint` forever (`BarWidget.qml` Timer
  `running: true`). DEMO does not back off. No inotify. Official clock uses
  `SystemClock`; this is a permanent process factory (Neural Pulse P1, 4s / 46ms
  there, 8s / 80ms here).
- **Security / path scope.** Unsandboxed in the Omarchy shell (README says so).
  `discover_hermes_homes` `resolve()` follows home and profile **symlinks**.
  `load_output_runs` `iterdir()` + `is_dir()` follows directory symlinks under
  `cron/output/` with **no** `Path.resolve()` prefix check (Cron Night P2).
  `HERMES_HOME` is not constrained to `$HOME`. Session/error text from every
  profile is screenshot-ready. Argv is a list (good); `python3` + script path
  are visible in `ps`.
- **Truncation / sort.** `load_executions_db` `ORDER BY claimed_at DESC LIMIT 500`
  with mixed ISO/epoch still sorts wrongly (Cron Night P1). Sessions now
  `ORDER BY COALESCE(started_at, ended_at) DESC LIMIT 500` (fixed).
  `CRON_SESSION_RE = ^cron_([A-Za-z0-9]+)_(.+)$` vs hyphenated test fixtures
  (`cron_abc123abc123_2026-09-19_02-00-00`) — same latent job-id truncate.
- **`degraded` is always `false`.** `night_payload` / `demo_snapshot` hardcode
  it. Partial unread cannot be consumed as degraded-live by a future face.
- **No vertical-specific star layout** (wave sibling has a `button.vertical`
  branch). 2D hash layout on a vertical 78px strip is noise.
- **Tests the current files avoid.** `formatClock` digits; `barMode` on
  `read_status: "partial"`; estimated star size vs `cost unknown`; 180s merge
  miss; `.env`-only home; daytime `finished_at` 18:01; hung without
  `started_at`; panel `windowText` vs `statusLine`. The 51 pytest cases are the
  happy path Honest night already believed.

---

## 4. P2 — improvements

- Honor **only** `HERMES_HOME` plus an explicit “all profiles” toggle. Profile
  ACL / snippet redaction is still open on Cron Night; do not pretend the
  `[kid]` badge is isolation.
- Treat `unknown` as its own chip (`n unknown`), not a silent increment of
  `failed`. Map audit-only `status is None` to `unknown` in **both**
  `summarize_runs` and `starKind` (dim/unknown, not red-fail / 0-failed).
- `formatClock` must use `window.tz` (or slice the ISO `T..` clock that
  `parse_datetime` already localized). Never `Date#getHours()` for a labeled
  IANA zone.
- `sizeUsd` = recorded `usd` only. Estimated may label the panel row (`~$`),
  never scale the bar.
- Bound `error_snippet` against secret-shaped tokens; refuse output symlinks
  that escape `cron/output/`.
- Tighten `_HOME_MARKERS` (require `cron/` or `state.db`, not `.env` alone).
  `present` for the widget should mean “opened cron storage,” not “found a
  marker.”
- SQLite `timeout=1.5` like Neural Pulse; if the probe exceeds one poll,
  mark STALE instead of painting yesterday as live.
- Stop the frame timer when the bar is hidden / locked; back off DEMO to
  ~60s; consider inotify on `cron/` instead of 8s full walks.
- Add `N profiles` to `summaryLine` when `profileCount > 1` (README already
  promised it). Surface `errors[0]` on the panel header always.
- `preview.png`; `qmllint` in README; pin a tag instead of git HEAD; define
  `closeForPopoutSwitch` on `Panel.qml`.
- CI: `python3 -m pytest tests -q` and `node tests/test_constellation_logic.js`.
  This repo has no workflow.
- Deduplicate the remaining window/cost/merge rules with Cron Night’s
  `plugin_api.py` (this file is already a spiritual copy). One fixture, two
  skins.

---

## 5. Quick wins (≤ 1 day)

1. **`barMode`: any `ok === false` or `errors.length` is not unmarked live.**
   `read_status === "unread"` → `ERR`. `partial` → `ERR` or a `PARTIAL` glyph
   (never a quiet green sky). Tests: the parent-ok + kid-`{not json` fixture
   must not yield `barLabel === ""`.
2. **Panel header always shows `statusLine`.** Do not prefer `windowText` when
   `ok === false`, `stale`, or `error`. Never show “Nothing ran in this
   overnight window.” unless `ok === true && read_status === "ok" && runs.length === 0`.
3. **`formatClock` in the window zone.** Parse offset and display *that*
   clock (or `T(\d{2}:\d{2})` from the already-localized ISO). Add a Node
   assert: `formatClock("2026-09-18T18:00:00-07:00") === "18:00"` regardless of
   host TZ.
4. **Stars size from `usd` only.** Drop `estimatedUsd` from `sizeUsd`. Keep
   `~$` on the row. Test: estimated 0.01 vs 2.0 with `usd: null` → both
   `EQUAL_SIZE`.
5. **Align status face.** `starKind(null)` / omitted → `unknown` (dim), not
   `fail`. Fail chip = `failed` only; running chip when `summary.running > 0`
   (Cron Night). Header color must not go mint when stars are red.
6. **README:** delete “the header notes how many profiles contributed” or
   add the count; say star size ignores estimates; say JS clock must match
   `--tz`; say `.env` alone is currently treated as a home (until P1).
7. **SQLite `timeout=1.5`** and treat a still-running probe past `POLL_MS` as
   STALE.

---

## 6. Suggested next ship (one concrete fix PR)

**Title:** Honest sky — unread/partial not live-green; panel shows errors; clock in window TZ.

**Scope (one PR, no visual restyle, no cost redesign, no profile ACL):**

1. `barMode` / `barLabel`: `ok === false` or probe `errors[]` cannot render as
   unmarked live. Partial unread must be self-describing on the **bar**.
2. `Panel.qml`: always surface `statusLine` on error/stale/partial; EmptyState
   copy only for successful empty reads.
3. `formatClock` / `windowLine` / `runMeta` display the probe window’s local
   clock, not `Date#getHours()`.
4. Tests for (1)–(3): parent+kid corrupt fixture → not `live`; unread present
   → no “Nothing ran…”; UTC host + LA window ISO → `18:00 → 08:00`.

Do **not** expand into estimated-USD redesign or profile isolation in that PR.
After it merges, the next opposition item is P0.3 (star size = actual only) +
P0.4 (unknown/hung chips) as a second PR.

---

## 7. What already holds (do not redo)

- **Single aggregator.** JS does not re-implement the night window. `probe.py`
  is the ledger. This closes Cron Night’s REST-vs-RPC split for this skin.
- **18:00 window actually moves.** `overnight_window` / `overnight_label`
  (`Tonight` after 18:00). Tests at 03:15, 08:00, 15:30, 18:00, 18:30, 23:00.
- **`--tz` from the Omarchy shell.** `Panel.qml` list-literal
  `["python3", probeScript, "--tz", timeZone]` (Neural Pulse argv style).
  Omitted/invalid → process local (documented). `test_night_payload_honors_tz_name`,
  `test_overnight_window_utc_vs_los_angeles_bounds`.
- **No token→USD table.** `normalize_cost` copies recorded fields;
  `test_normalize_cost_never_invents_usd`,
  `test_normalize_cost_does_not_coerce_missing_to_zero`.
  Summary omits `usd` on partial coverage
  (`test_summarize_runs_omits_usd_total_when_coverage_is_partial`).
  Panel `costLine` prints `partial (k/n billed)`.
- **Unknown is not completed in the probe.** Sessions, unaudited markdown,
  clean audit lines (`test_session_end_reason_timeout_is_unknown`,
  `test_unaudited_markdown_is_unknown_not_completed`,
  `test_usage_audit_without_error_does_not_paint_completed`).
- **Hung 17:00 spillover is kept** (`test_hung_running_started_before_window_is_kept`).
  `pgrep` is not used (Node assert + README).
- **`last_run_at` skipped when executions/output/audit/session exist**
  (`test_last_run_at_skipped_when_executions_exist`).
- **Cache tokens counted; merge partners on started *or* finished**
  (`test_normalize_cost_includes_cache_tokens`,
  `test_merge_matches_audit_to_finished_at_not_only_started`).
- **Sessions newest-first LIMIT 500**
  (`test_load_cron_sessions_orders_newest_first`).
- **DEMO / ERR / STALE glyphs exist** on the bar (Neural Pulse Honest-pulse
  lesson). Empty `~/.hermes` is DEMO (`test_empty_home_is_demo`). Corrupt
  `jobs.json` / `executions.db` with no other runs is unread
  (`test_corrupt_jobs_json_surfaces_errors_not_quiet_night`,
  `test_build_snapshot_unread_jobs_is_error_not_quiet`).
- **SQLite is opened read-only** (`mode=ro` + `PRAGMA query_only = ON`).
  Process argv is a list (no shell interpolation).
- **Quattro bar-widget shape is largely correct:** `schemaVersion: 1`, id
  `smf.cron-constellation` (not `omarchy.*`), `kinds: ["bar-widget"]`,
  `entryPoints.barWidget`, nested `Loader` panel, `moduleName`, `injectPanel`,
  `opened` / `open` / `close` / `toggle` / `closeForPopoutSwitch` on the bar
  root, `manageIpc: false`, `qs.Ui` / `qs.Commons`, Canvas `z: 1` (not behind
  the button — Neural Pulse P1 #10). No repo symlinks.
- **Merge prefers failure.** `_prefer_status` ranks
  `failed > unknown > running > claimed > completed`.
- **Unsandboxed warning + python3 requirement** are in the README (Neural
  Pulse install gap that Honest pulse closed).
- **The 51 pytest + Node helpers are correct for what they claim.** They are
  not a screenshot-acceptance suite.

None of that makes a starfield screenshot safe. It means the next PR can stay
small: refuse live-green on unread/partial, put the error on the panel, and
print the clock in the zone the probe already used.

---

## Appendix — tests run on this agent

```
python3 -m pytest tests -q
...................................................                      [100%]
51 passed in 0.26s

node tests/test_constellation_logic.js
ok - ConstellationLogic helpers
```

`python` is not required; `python3` is on PATH. `pytest` is not a runtime
dependency (`pip install pytest` needed here). No GitHub Actions workflow
in-tree.
