# Audit 002: Static navigation accuracy and project scope

- **Date:** 2026-09-06
- **Audited commit:** `d0fa274`
- **Result:** Navigation implementation correct after the fixes recorded below;
  higher-timeframe liquidity requirements remain outside the current chart.

## Verified

- All 180 published session payloads exactly match fresh results from the
  canonical SQLite database opened in read-only mode: 15 study days, six
  sessions, and two timeframes.
- The comparison covered 22,635 rendered candles. Every timestamp is strictly
  increasing and every candle satisfies its OHLC bounds.
- New York session conversion, the prior-evening Asia trade-date rule, and the
  1-minute to 5-minute complete-bucket aggregation match the local API.
- Previous, Next, Latest, calendar selection, session changes, timeframe
  changes, comparisons, URL restoration, replay cutoff, and renderer fallback
  pass browser tests.
- The catalog and every day file are deterministic and checksummed. The browser
  verifies the declared byte length and SHA-256 digest before parsing a day.
- No market database write occurs. The Python connection uses SQLite `mode=ro`
  and `PRAGMA query_only = ON`.

## Corrections made during this audit

- Verify published day hashes in the browser and version day requests by their
  digest so an older cached response cannot be mixed with a newer catalog.
- Repair an invalid shared date URL to the latest available study day.
- Remove exporter-owned stale day files when rebuilding a narrower catalog.
- State that direct `file://` opening cannot provide JSON-backed navigation;
  the public HTTPS page or local HTTP server is required.

## Scope gaps

The current page is an intraday NQ session-study prototype. It does not yet
implement these requested outputs:

- 1D candlestick view;
- weekly and monthly high/low levels;
- confirmed swing-high and swing-low detection;
- relative equal-high and equal-low detection;
- sweep detection and post-sweep outcome statistics;
- a higher-timeframe liquidity map;
- S&P 500 or long-lived-stock datasets;
- a full-history backtest.

The page currently computes previous-session and prior-RTH levels and displays
one mechanical three-candle FVG candidate. References to higher-timeframe
liquidity elsewhere on the page are study prompts, not detector output. The UI
should not be described as a complete liquidity backtest until the missing
detectors, definitions, data, and validation are added.

