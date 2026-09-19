# Cron Constellation

Futuristic Omarchy Quattro `bar-widget` from SMF Works. The bar shows a mini
**starfield** of last night’s Hermes cron runs — green stars = success, red =
failed/unknown, star size ∝ recorded cost (equal size when cost is unknown).
Click it for a dark-glass constellation panel: overnight runs with name, time,
status, tokens, and USD **only when Hermes stored one**.

Plugin id: `smf.cron-constellation`. Twin of the Hermes Desktop digest
[SMF Cron Night](https://github.com/smfworks/smf-cron-night). Companion to
[Neural Pulse](https://github.com/smfworks/omarchy-neural-pulse).
Adversarial review of whether the starfield is screenshot-trustworthy:
[docs/OPPOSITION.md](docs/OPPOSITION.md).

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

- **DEMO** — no readable Hermes cron home. Dim demo stars, not a quiet night.
- **ERR** — probe failed or cron storage existed but could not be opened
- **STALE** — showing the last good snapshot after a failed refresh
- unmarked — last probe succeeded against a Hermes home
- red fail-count chip — overnight failures (and unknown) when the last probe was live/stale

An empty `~/.hermes` directory is demo, not “all quiet.” Unreadable
`jobs.json` / `executions.db` is **ERR**, never a silent empty sky. The widget
never invents USD from token counts. Partial billing is labeled
`partial (k/n billed)`.

## Data

When present, Cron Constellation reads the same Hermes cron storage as
[Cron Night](https://github.com/smfworks/smf-cron-night) (`plugin_api` spirit)
and [smf.hermes](https://github.com/smfworks/smf-hermes). `HERMES_HOME` and
`--tz` come from the **Omarchy shell** process, not from an interactive
terminal:

| Path | What we take |
|------|----------------|
| `cron/jobs.json` | name, schedule; `last_run_at` only when that job has no executions / output / audit / session rows |
| `cron/executions.db` | attempt ledger: `claimed` → `running` → `completed` \| `failed` \| `unknown` |
| `cron/usage_audit.jsonl` | token counts (no USD). A clean audit line does not paint `completed`. |
| `cron/output/{job_id}/{timestamp}.md` | output + error snippet; `{timestamp}.audit.json` when present |
| `state.db` sessions `source=cron` | `cron_{job_id}_{timestamp}` rows; USD only if stored |

**Overnight window** (local, IANA `tz` honored when passed):

- before 18:00 → yesterday 18:00 → today 08:00
- at/after 18:00 → today 18:00 → tomorrow 08:00

Unknown status is not completed. Hung `running`/`claimed` work that started
before 18:00 stays visible. `pgrep` is not used.

**Named profiles are aggregated.** If more than one home is readable, rows are
badged with the profile name (`[work] …`) and the header notes how many
profiles contributed. This is not Hermes isolation; treat the panel as a union
view.

## Tests

```sh
python3 -m pytest tests
node tests/test_constellation_logic.js
```

`pytest` is a test-only dependency (`pip install pytest`).

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
