# ADR 001: Migrate the study chart to Lightweight Charts in reversible stages

- **Status:** Implemented
- **Date:** 2026-09-06
- **Decision owners:** ICTLEARN maintainers

## Context

The current study page draws candles and ICT study overlays with a hand-built SVG renderer. It already preserves several important boundaries: candles come from observed OHLC rows, replay hides bars after its cursor, source provenance remains visible, the local API is read-only, and candidate FVGs are described as mechanical illustrations rather than signals.

Replacing the renderer in one step would couple verified data behavior to a large visual change. It would also make a regression in replay, timestamps, missing bars, or source labels difficult to isolate.

## Decision

Adopt TradingView Lightweight Charts 5.2.0 as a pinned, vendored browser dependency and use it as the default chart renderer. Keep the existing SVG renderer available through the Renderer control or `?renderer=svg` as an immediate rollback path.

All renderers consume the same versioned chart-scene adapter. The adapter owns the boundary between observed market data and visual presentation. It emits only candles available at the replay cursor and carries the display timezone, API window, missing slots, study overlays, and source provenance as explicit fields.

For GitHub Pages, publish a bounded catalog of precomputed session responses.
The page tries the read-only local API first, then this static catalog, and only
then the single embedded example. The static catalog enables date, session,
timeframe and comparison controls without exposing or copying the full local
database. Every published day has a SHA-256 digest in the catalog.

The local Python service, database path, read-only database access, session definitions, source boundary, and FVG detector remain unchanged in this migration slice.

## Rollout

1. Preserve the SVG baseline and add browser checks for its static fallback. **Complete.**
2. Introduce the `ictlearn.chart-scene` version 1 adapter and contract tests. **Complete.**
3. Add a Lightweight Charts renderer with candles, crosshair, zoom, replay, prior-range levels, RTH levels, candidate FVG, timing windows, source boundary, manual levels, and normalized comparison. **Complete.**
4. Compare both renderers against the same scene for OHLC count, first/last timestamp, replay cutoff, and enabled overlay inventory. **Complete for the embedded example.**
5. Verify representative read-only local API sessions at 1 minute and 5 minutes, then make Lightweight Charts the default. **Complete.**
6. Keep `?renderer=svg` as a rollback path for at least one published release. Removing it requires a separate decision. **Active.**
7. Publish bounded per-day static responses so GitHub Pages navigation works without the Python API. **Complete.**

## Acceptance gates

- GitHub Pages works without a runtime package manager or third-party network request.
- Published study dates render in both modes from a static server, with the embedded example retained as a last-resort fallback.
- The local API path continues to render 1-minute and aggregated 5-minute OHLC without modifying the database.
- Replay never passes a candle, FVG, comparison point, or annotation dated after the selected cutoff.
- The visible OHLC readout matches the displayed candle and uses America/New_York for labels.
- Missing source slots remain gaps; renderers do not synthesize candles.
- Source counts and the Databento/Yahoo boundary remain available in the scene and UI.
- A renderer failure falls back to SVG with a visible status message.
- Existing notes, drawing inputs, session controls, and URL state keep working.

## Consequences

The repository gains a roughly 196 KB minified browser asset and its Apache-2.0 license. Rendering code becomes easier to extend with financial-chart interactions, while concept detection remains independent of the chart library. During migration, both renderers must be maintained and parity-tested.
