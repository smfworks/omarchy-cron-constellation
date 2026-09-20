# Cron Constellation

Futuristic Omarchy Quattro `bar-widget` from SMF Works. The bar shows a mini
**starfield** of last night’s Hermes cron runs — theme-accent = completed, urgent
= failed, dim = unknown, accent chip = still running. Star size ∝ **recorded**
USD only (equal size when Hermes stored no bill). Click it for a glass
constellation panel: overnight runs with name, time, status, tokens, and USD
**only when Hermes stored one**.

Plugin id: `smf.cron-constellation`. Twin of the Hermes Desktop digest
[SMF Cron Night](https://github.com/smfworks/smf-cron-night). Companion to
[Neural Pulse](https://github.com/smfworks/omarchy-neural-pulse).

**Do not treat a screenshot of the starfield as overnight-ops truth.** Read
[docs/OPPOSITION.md](docs/OPPOSITION.md) (Round 2 / Honest sky). Unread storage,
a stuck probe, or a DEMO install can look like “all quiet” unless you read the
glyph.

## Demo

Cron Constellation on Omarchy (mikesai6) — overnight starfield on the bar plus the constellation panel.

https://github.com/smfworks/omarchy-cron-constellation/releases/download/demo/demo.mp4

## Requirements

- **python3** — the widget probes Hermes cron storage with `probe.py` every 8s.
  Without it the bar shows **ERR**, not a live install.
- Omarchy Quattro / Quickshell (this is a `bar-widget` plugin)

Plugins run **unsandboxed** inside the long-lived Omarchy shell process, with
your user permissions. Review the repo before enabling.

## Install

```sh
omarchy plugin add https://github.com/smfworks/omarchy-cron-constellation.git --enable
omarchy bar move smf.cron-constellation --section right
```

`defaultSection` is already `right`; `bar move` is optional configure.

## Usage

- Left click the starfield to open or close the constellation panel
- Middle click or press `R` to refresh
- Escape closes the panel

The bar labels its mode so a screenshot is self-describing:

- **DEMO** — no opened Hermes cron home (`cron/` or `state.db`). Dim demo
  stars, not last night. A lone `.env` or `config.yaml` stays DEMO.
- **ERR** — probe failed, or cron storage existed but could not be fully read
  (`ok: false`, `read_status: unread|partial`, or `errors[]`)
- **STALE** — showing the last good snapshot after a failed refresh, or after
  the probe ran longer than one poll
- unmarked — last probe succeeded against opened cron storage
- red fail-count chip — overnight **failures** (not unknown) when the last
  probe was live/stale
- accent running chip — in-window `running` / `claimed` work

An empty `~/.hermes` directory is demo, not “all quiet.” Unreadable
`jobs.json` / `executions.db` is **ERR**, never a silent empty sky. Partial
unread (one home ok, another corrupt) is **ERR** even if some stars exist.

## Honesty caveats

- **Unread ≠ empty.** “Nothing ran in this overnight window.” only appears
  after a successful empty read (`ok: true`, `read_status: ok`, no `errors[]`).
- **Clock is the probe window.** Face times are sliced from the localized ISO
  the probe already emitted (`--tz` from the Omarchy shell). They are not
  `Date#getHours()` in the Quickshell host zone. Cron Night’s 18:00 → 08:00
  window is the same function.
- **No invented USD.** Token counts never become dollars. Star size ignores
  `estimated_cost_usd`. The panel may label a row `~$` when Hermes stored an
  estimate; the sky does not grow for it. Partial billing is
  `partial (k/n billed)`, never a bare `$` total.
- **Unknown ≠ failed ≠ running.** A clean `usage_audit` line, a timeout
  `end_reason`, or a `last_run_at` pointer without a ledger row is **unknown**
  (dim), not a red fail and not a green ok. Fail chip counts `failed` only.
- **Named profiles are aggregated.** If more than one home is readable, rows
  are badged (`[work] …`) and the header notes `N profiles`. This is not
  Hermes isolation; treat the panel as a union view.
- **DEMO is labeled.** The widget does not invent live cron rows for the demo
  sky.

## Data

When present, Cron Constellation reads the same Hermes cron storage as
[Cron Night](https://github.com/smfworks/smf-cron-night) (`plugin_api` spirit)
and [smf.hermes](https://github.com/smfworks/smf-hermes). `HERMES_HOME` and
`--tz` come from the **Omarchy shell** process, not from an interactive
terminal:

| Path | What we take |
|------|----------------|
| `cron/jobs.json` | name, schedule; `last_run_at` only when that job has no executions / output / audit / session rows (pointer → `unknown` unless it recorded a failure) |
| `cron/executions.db` | attempt ledger: `claimed` → `running` → `completed` \| `failed` \| `unknown` |
| `cron/usage_audit.jsonl` | token counts (no USD). A clean audit line does not paint `completed`. Bad JSONL lines are errors, not skipped. |
| `cron/output/{job_id}/{timestamp}.md` | output + error snippet; `{timestamp}.audit.json` when present |
| `state.db` sessions `source=cron` | `cron_{job_id}_{timestamp}` rows; USD only if stored |

**Overnight window** (IANA `tz` honored when passed — same as Cron Night):

- before 18:00 → yesterday 18:00 → today 08:00
- at/after 18:00 → today 18:00 → tomorrow 08:00

Unknown status is not completed. Hung `running`/`claimed` work that started
before 18:00 stays visible when it has a start stamp. Daytime work that only
*finished* after 18:00 is not overnight. `pgrep` is not used. SQLite opens
read-only with a 1.5s timeout.

## Tests

```sh
python3 -m pytest tests
node tests/test_constellation_logic.js
```

`pytest` is a test-only dependency (`pip install pytest`).

Optional QML check (when the Omarchy shell tree is on disk):

```sh
qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml
```

## Contract

- `schemaVersion: 1`, id `smf.cron-constellation` (not `omarchy.*`)
- `kinds: ["bar-widget"]`, `entryPoints.barWidget: "BarWidget.qml"`
- Nested details panel loaded from `BarWidget.qml` via `Loader`
- `moduleName` matches the plugin id; `injectPanel`, `open`, `close`,
  `toggle`, and `closeForPopoutSwitch` are forwarded to the panel
- Imports `qs.Ui` / `qs.Commons`; no symlinks

```sh
omarchy plugin validate .
```

## Remove

```sh
omarchy plugin remove smf.cron-constellation
```

## License

MIT. Copyright (c) 2026 SMF Works.
