# Journal Financial Charting Standard

- **Standard:** JCS-1
- **Status:** Required
- **Effective:** 2026-09-07
- **Canonical example:** `ICTLEARN/prototype/ict_notes_demo.html`
- **Canonical renderer:** `ICTLEARN/prototype/lightweight_renderer.js`
- **Canonical scene boundary:** `ICTLEARN/prototype/chart_scene_adapter.js`

## 1. Purpose and scope

JCS-1 defines the standard manner for interactive financial price charts in
every project under the `JOURNAL` folder. It applies to HTML chart tools,
research explorers, replay pages, backtest viewers, and report dashboards that
display market OHLC data.

The chart must help the user see price first. Controls and explanations support
the chart without competing with it. The interface should make time, price,
data provenance, missing observations, and the availability time of every
overlay clear with minimal reading.

The ICTLEARN page is the visual and interaction reference. It is not the source
of truth for every trading concept. A future chart may add detectors or
instruments only when their inputs, definitions, and tests are supplied.

## 2. Required architecture

Every interactive price chart MUST use these layers:

1. **Data adapter** — reads observed OHLC and metadata without changing the
   underlying market-data store.
2. **Versioned scene model** — validates and converts data into a
   presentation-neutral chart scene.
3. **Primary renderer** — TradingView Lightweight Charts, pinned and stored in
   the project or supplied through an equivalently reproducible build.
4. **Study overlay** — an SVG layer aligned to chart time and price coordinates
   for ranges, gaps, timing windows, annotations, and manual drawings.
5. **Preserved fallback** — a working SVG or canvas chart that remains usable
   when the primary library cannot initialize.

Data detection, scene construction, and rendering MUST remain separate. A
renderer may display a supplied fact; it MUST NOT invent, repair, qualify, or
reinterpret market data or a trading concept.

The canonical scene schema is `ictlearn.chart-scene` version 1 as documented in
`ICTLEARN/docs/CHART_SCENE_CONTRACT.md`. Other projects may extend the schema,
but MUST version incompatible changes and validate all new fields before
rendering.

## 3. Standard workspace

The default page order is:

1. compact application bar;
2. layer toolbar;
3. dominant chart area;
4. replay or inspection controls;
5. one-line data/provenance footer;
6. dialogs or drawers for detailed notes, definitions, and sources.

The application bar SHOULD contain, in this order:

- instrument identity and timeframe;
- date navigation and market/session selection;
- comparison, notes, renderer, and reset actions.

The layer toolbar MUST use explicit on/off controls with `aria-pressed`. Keep
the default layer count low enough that candles, wicks, and major references
remain legible. Put extended definitions and methodology in a dialog or linked
study page rather than permanently beside the plot.

The chart area MUST grow to use the available viewport. Use a minimum chart
height of 280 px and avoid page-level horizontal scrolling at 390 px viewport
width. Controls may wrap or become horizontally scrollable before the chart is
reduced below a useful reading size.

## 4. Visual tokens

Use this palette unless an existing project has an approved accessible brand
theme. Semantic meanings MUST remain consistent even when exact colors change.

| Token | Value | Meaning |
|---|---:|---|
| Background | `#0b111b` | Page and chart background |
| Panel | `#111b29` | Controls and dialogs |
| Grid | `#1c293a` | Quiet chart grid |
| Border | `#243246` | Dividers and scale borders |
| Text | `#e1eaf4` | Primary text |
| Muted | `#91a2b8` | Secondary labels and prior RTH |
| Gold | `#e6b668` | Primary reference range and focus |
| Violet | `#aa9aff` | FVG or imbalance candidate |
| Mint | `#62d4b4` | Up candle and timing window |
| Rose | `#f18491` | Down candle and wick measurement |
| Comparison | `#9eafff` | Normalized comparison path |

Use the system UI font for controls and a system monospace font for OHLC,
timestamps, and compact numeric readouts. Body text defaults to 13 px, control
labels to 11–12 px, and chart annotations to 9–10 px.

Use subtle fills for zones so candles remain visible:

- prior-range premium: gold at approximately 4.5% opacity;
- prior-range discount: mint at approximately 3.5% opacity;
- FVG candidate: violet at approximately 16% opacity;
- timing window: mint at approximately 5% opacity;
- manual zone: gold at approximately 10% opacity.

Reference lines SHOULD be dashed. Equilibrium and midpoint lines SHOULD be
dotted. Comparison paths MUST be visually distinct, use their own hidden scale,
and state their normalization method.

## 5. Candlesticks and scales

OHLC price data MUST render as candlesticks. Do not substitute a close-only
line when OHLC values exist.

- Up candles: mint body, border, and wick.
- Down candles: rose body, border, and wick.
- Price scale: right side, visible border, minimum width near 82 px.
- Time scale: visible time, no seconds unless required by the source timeframe.
- Crosshair: normal/free crosshair with synchronized OHLC readout.
- Zoom and pan: enabled for pointer and trackpad users.
- Initial view: fit the selected dataset once when instrument, date, session,
  or timeframe changes. Do not repeatedly reset the user's zoom during redraws.

Prices MUST pass through the scene without rounding. Round only for display
using the instrument's tick size. NQ uses `minMove: 0.25` and two displayed
decimal places. Each new instrument MUST declare its own tick size and price
format.

A `1D` option MUST contain actual daily OHLC candles. Its session basis
(exchange day, RTH, or electronic trade date) and timezone MUST be named. A
daily candle MUST NOT be created by relabeling an intraday window.

## 6. Time and session rules

- Preserve source timestamps in UTC.
- Convert labels and session windows to the declared display timezone only at
  the presentation boundary.
- NQ/US-index session studies use `America/New_York` and timezone-aware DST
  conversion.
- Use half-open windows: start timestamp included, end timestamp excluded.
- State the trade-date rule for sessions that cross midnight. Under the current
  ICT convention, Monday Asia begins Sunday at 20:00 ET.
- Never assume a fixed UTC offset for New York.

Date arrows MUST move to the previous or next date with observations for the
selected instrument, session, and timeframe. `Latest` MUST resolve through the
same availability catalog. A shared URL MUST describe the chart actually shown;
invalid dates must resolve to a valid date or produce a visible error.

## 7. Data integrity and provenance

Charts MUST preserve the data contract of their project. For Journal NQ data,
`NQ_DATABASE_INSTRUCTIONS.md` remains authoritative.

- Open canonical SQLite market data in read-only/query-only mode.
- Do not interpolate, forward-fill, or synthesize missing OHLC bars.
- Keep missing time slots visible as gaps.
- Aggregate higher intraday timeframes only from complete source buckets unless
  the chart explicitly labels partial candles.
- Reject invalid OHLC bounds, non-finite prices, duplicate/unsorted timestamps,
  unsupported timeframes, and out-of-window slots.
- Record instrument, timeframe, exact source window, latest source timestamp,
  expected observations, observed observations, and source labels.
- Keep data-source boundaries visible when they fall inside the selected view.
- Static published responses MUST have a manifest, byte length, SHA-256 digest,
  schema version, and bounded publication statement. Verify the response in the
  browser before parsing it.

The one-line footer MUST identify at least instrument, selected date,
timeframe, observed/expected source rows, and gaps. Detailed provenance belongs
in a Data & sources panel.

## 8. Overlay and concept rules

Every overlay MUST define:

- input timeframe and source;
- deterministic detection rule;
- earliest timestamp at which it becomes knowable;
- price bounds or level calculation;
- invalidation or completion state where applicable;
- whether it is observed, calculated, user-entered, or illustrative.

Replay MUST exclude candles and overlays that occur after the replay cutoff.
Annotations may appear only when their availability time is at or before the
last visible candle.

An FVG candidate uses three consecutive complete candles. Its box may begin
only after the third candle closes. If a project uses a stricter concept such as
“first presented FVG,” the qualifying window and selection rule must be defined
separately. Do not imply probability, direction, or trade validity from a
mechanical gap.

Higher-timeframe liquidity, swing points, relative equal highs/lows, session
highs/lows, weekly highs/lows, and monthly highs/lows MUST be computed by named,
tested rules before being drawn. Educational prompts or manually entered
levels must be labelled as such and MUST NOT appear as detector output.

Use consistent semantic styling:

- primary/prior range: gold;
- FVG/imbalance: violet;
- timing or session shading: mint;
- wick measurement: rose;
- secondary/prior RTH: muted;
- normalized comparison: comparison lavender;
- user-entered drawing: gold with explicit `user` label.

## 9. Replay, comparison, and interaction

The standard replay strip contains Play/Pause, Previous candle, timeline,
Next candle, cutoff time, and event jumps. Event jumps MUST remain hidden until
the event itself is available at the replay cursor.

Selecting a candle updates the OHLC readout and may enable exact wick midpoint
measurement. Selecting a reference level may show price distance and whether
price is moving toward or away from that level. Manual drawings must be stored
separately by instrument/date/session/timeframe.

Comparison overlays MUST state their unit and resampling method. The ICTLEARN
standard uses percentage change from the comparison's opening price and keeps
the last observed comparison close mapped to each active slot. Do not present a
normalized path as an executable price series.

## 10. Accessibility and responsive behavior

Every chart page MUST provide:

- a chart `role="img"` and an informative accessible label;
- labels for every input and select;
- `aria-pressed` for layer toggles;
- `aria-live` OHLC or inspection feedback;
- visible `:focus-visible` outlines with at least 2 px contrast;
- keyboard candle stepping with Left/Right arrows;
- disabled states during unavailable or loading operations;
- visible loading, timeout, fallback, and data-error messages;
- a non-color cue such as line style, label, or shape for every semantic layer.

At 390 × 844 px, the document width MUST equal the viewport width and the chart
must remain usable. Print mode may hide controls, but must preserve the chart,
title, timeframe, date, and provenance.

## 11. Dependency and delivery rules

- Pin the exact chart-library version and retain its license and integrity hash.
- Do not depend on a CDN for a published Journal chart.
- Prefer a static HTTP-served build for portable research artifacts.
- A local API may provide full history; a hosted static build must state its
  publication window and must not imply full-history coverage.
- Direct `file://` pages cannot normally fetch companion JSON. Use an HTTP
  server, embed a bounded fallback, or state that navigation is unavailable.
- Escape all user-provided labels before placing them into SVG or HTML.

## 12. Technology and repository policy

JCS-1 separates approved implementation dependencies, reference-only material,
optional analytical tools, and excluded dependencies. A repository link is not
an endorsement of its market concepts, detector definitions, signals, or data
rights. Before adding or upgrading a dependency, re-check its primary
repository documentation, exact version, license, notices, and suitability for
the requested chart boundary. Retain the applicable license and notices with
any vendored or copied code.

### 12.1 Approved implementation dependencies

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts)
  is the approved primary browser chart engine. Its repository describes it as
  an interactive financial HTML5 chart library with a standalone build and
  custom-plugin support. It is Apache-2.0, and its repository requires
  TradingView attribution and a link as described in its
  [README](https://github.com/tradingview/lightweight-charts#license) and
  [NOTICE](https://github.com/tradingview/lightweight-charts/blob/master/NOTICE).
  Pin the exact version, vendor the published build for Journal charts, retain
  its license and integrity hash, and satisfy the attribution requirement. The
  current ICTLEARN implementation vendors Lightweight Charts 5.2.0 and uses
  the `attributionLogo` chart option.
- [Databento Python](https://github.com/databento/databento-python) is an
  approved ingestion and validation client when Databento access is used. Its
  primary documentation describes historical/live access, OHLCV and
  normalized schemas, futures symbology, point-in-time definitions, replay,
  batch download, and Pandas/NumPy/CSV/JSON conversion. It is Apache-2.0.
  Keep API credentials in environment variables such as
  `DATABENTO_API_KEY`; never commit them. Using this client MUST NOT relax the
  Journal read-only database contract or establish rights to redistribute
  downloaded market data.
- [yfinance](https://github.com/ranaroussi/yfinance) is permitted only for the
  mutable Yahoo continuation or reconciliation path already defined by the
  project. Its code is Apache-2.0, but its own documentation directs users to
  Yahoo's terms for rights to the downloaded data and warns that the API is
  intended for personal use. Code licensing does not grant unrestricted rights
  to publish Yahoo data. Preserve the fixed Databento/mutable Yahoo source
  boundary and the project's publication limits.

Approved dependencies remain subject to the data-source, provenance, replay,
and validation rules in this standard and in `NQ_DATABASE_INSTRUCTIONS.md`.

### 12.2 Reference-only sources

- [Pine Script Indicator Suite](https://github.com/jbondata/pinescript-indicator-suite)
  is a reference-only source for visual patterns and learning examples. Its
  repository identifies the project as educational/visualization material and
  declares Mozilla Public License 2.0. Port only explicitly reviewed visual
  behavior, such as FVG boxes, session boundaries, true opens, macros, or
  liquidity-swing illustrations. Do not import its signals, probability
  assumptions, confluence scoring, or definitions as authoritative ICT truth.
  If code is copied or modified, preserve the MPL-2.0 obligations.
- [ICT Trading Research](https://github.com/brodenbeck1/ict_trading) may provide
  architecture inspiration for separating concepts, detectors, tests, models,
  and chart outputs. Do not copy code or add it as a dependency until its
  current license and suitability have been explicitly verified.

Reference material cannot override the Journal report contract, the NQ data
contract, or a project's named and tested detector definitions.

### 12.3 Optional analytical tools

- [DuckDB](https://github.com/duckdb/duckdb) is an optional MIT-licensed batch
  analysis tool for analytical SQL and direct CSV/Parquet queries. It may
  generate catalogs, research features, or deterministic export inputs, but it
  MUST NOT become the browser chart's source of trading interpretation.
- [Polars](https://github.com/pola-rs/polars) is an optional MIT-licensed batch
  analysis tool for lazy, parallel, or streaming feature extraction. Use it for
  deterministic preprocessing and validation, not browser-side concept
  inference.
- [Smart Money Concepts](https://github.com/gabrielkoerich/smart-money-concepts)
  may be evaluated as an optional detector sandbox only after its current
  license and suitability have been reviewed. Its repository currently shows
  MIT, but that does not validate its ICT definitions or make its outputs
  authoritative. Any port must have a named rule, availability time, source
  boundary, and focused tests before it can appear as detector output.

### 12.4 Excluded dependencies and repositories requiring caution

- [backtesting.py](https://github.com/kernc/backtesting.py) is separate from
  the chart layer. Its repository declares AGPL-3.0; any future research use
  must be isolated and its license obligations reviewed before distribution.
- [CCXT](https://github.com/ccxt/ccxt) is excluded from the NQ/Databento chart
  stack. Its primary domain is a unified API for crypto exchanges and
  prediction markets, not the Journal's NQ historical-data workflow.
- [Castle Trade SMC Indicators](https://github.com/castletrade/pine-script-smc-indicators)
  is excluded unless its licensing and copying restrictions are reconciled by
  an explicit review. Its repository displays an MIT marker but also states
  that the materials are exclusive property and restricts unauthorized copying,
  distribution, and use. Do not copy its code or definitions while that
  conflict remains.
- All-in-one ICT or SMC strategy repositories that combine display,
  interpretation, and trade signals are excluded from the core chart stack
  unless their boundaries can be separated, tested, and licensed. A strategy
  repository is not evidence that a detector or trading concept is valid.

### 12.5 Current implementation sequence and status

The following sequence records implementation status without treating pending
research as completed capability:

| Sequence item | Status | Current boundary |
|---|---|---|
| Lightweight Charts migration | **Complete** | Lightweight Charts 5.2.0 is vendored and primary; the SVG renderer remains the fallback. |
| Read-only Python API and Databento/Yahoo provenance | **Complete** | The local API reads the NQ SQLite source read-only, labels the fixed Databento and mutable Yahoo segments, and does not write market data. |
| Structured versioned scene response | **Complete** | `ictlearn.chart-scene` version 1 is the presentation-neutral adapter boundary shared by the renderers. |
| Session, macro, FVG, prior-range, wick, comparison, and replay visuals | **Partly/mostly complete** | Session navigation, macro windows, prior-session/prior-RTH references, one mechanical three-candle FVG candidate, wick midpoint interaction, manual drawings, normalized comparison, and replay are present. True-open and higher-timeframe detector work is not present. |
| Static per-day GitHub Pages files | **Complete** | The bounded catalog publishes checksummed per-day snapshots for 15 trading days, six sessions, and 1-minute/5-minute views. It is not the full local archive. |
| Strategy/backtesting separation | **Required and preserved** | The chart remains an educational study surface; no strategy engine, execution system, or performance claim is part of the chart implementation. |
| True-open detectors | **Pending** | No named, tested true-open detector is currently part of the published chart contract. |
| Liquidity-swing, daily, weekly, monthly, and higher-timeframe liquidity detectors | **Pending** | These require explicit definitions, inputs, availability times, and tests before display. |

The current chart MUST NOT be described as implementing daily candles, weekly or
monthly highs/lows, confirmed swing detection, relative equal highs/lows,
higher-timeframe liquidity, S&P 500 or long-lived-stock coverage, or a
full-history backtest. Educational prompts, manually entered levels, or
repository references do not satisfy those requirements.

## 13. Required validation

Before a chart is considered complete, its project MUST test:

1. OHLC bounds, finite values, timestamps, slot order, and supported timeframe;
2. exact candle count and first/last timestamp;
3. missing-slot preservation and complete-bucket aggregation;
4. replay cutoff with no future candles, levels, zones, or annotations;
5. default renderer and preserved fallback renderer;
6. renderer parity for candle count, cutoff, and enabled overlay inventory;
7. crosshair/selection, zoom/pan overlay alignment, date navigation, timeframe,
   session, comparison, reset, and shared URL state;
8. mobile width at 390 px and keyboard operation;
9. visible data provenance and source-boundary behavior;
10. zero unexpected external requests;
11. static manifest byte-length and SHA-256 verification when static data is
    published;
12. exact adapter/API equality against representative read-only source data.

Tests should fail on malformed input rather than repairing it. Browser smoke
tests must exercise real interactions, not only inspect source text.

## 14. Adoption checklist

Use this checklist when creating or materially changing a chart:

- [ ] Chart is the dominant visual element and uses the standard workspace.
- [ ] Real OHLC renders as candlesticks.
- [ ] Primary and fallback renderers consume the same validated scene.
- [ ] Visual tokens and overlay meanings follow JCS-1.
- [ ] UTC storage, display timezone, DST, and trade-date rule are explicit.
- [ ] Tick size and timeframe construction are declared.
- [ ] Missing data remains missing.
- [ ] Replay prevents look-ahead.
- [ ] Concept detectors have named rules and availability times.
- [ ] Source, cutoff, coverage, and publication bounds are visible.
- [ ] Keyboard, mobile, loading, error, and fallback states pass.
- [ ] Automated validation in section 13 passes.

## 15. Change control

JCS-1 is the default for all descendant projects. A project-specific variation
must document the reason, preserve the data and replay guarantees, and identify
the approved difference in its README or architecture decision record.

Changes to shared semantic colors, renderer architecture, time handling,
provenance, or validation gates require a new revision of this standard. Visual
experiments may be developed behind an explicit preview or renderer switch
while the JCS-1 path remains available.
