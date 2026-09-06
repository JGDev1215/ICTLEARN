# NQ ICT delivery-plan project baseline

## Purpose

Build an NQ-focused report-preparation workflow that turns verified market data
and user/chart inputs into structured ICT delivery plans. It is a planning and
journaling tool, not a prediction, signal, execution, or position-sizing
system.

## Controlling references

1. [ICT Futures Report Spec](GROK/ICT_FUTURES_REPORT_SPEC.md) is the reporting
   contract. Its terminology, report-selection rules, exact templates,
   disclaimer, `DATA GAPS` behavior, and self-checks govern the output.
2. [NQ database instructions](NQ_DATABASE_INSTRUCTIONS.md) govern local market
   data access. Query the linked SQLite database read-only.
3. [`WRITEUP_local_codex` integration analysis](WRITEUP_LOCAL_CODEX_INTEGRATION.md)
   governs workflow controls, input boundaries, provenance, report freezing,
   and the current implementation gate.
4. [NQ RTH opening-gap fill study](rth_gap_fill/README.md) is a separate,
   descriptive research tool. Its results must not be presented as a report
   bias, signal, or performance claim.

If the references conflict, do not invent a reconciliation: flag the conflict
and keep the affected output field as `TBD`.

## Initial scope

- **Instrument:** NQ; use the `NQ`, 1-minute `candles` series.
- **Clock:** Convert database UTC timestamps to `America/New_York` before
  deriving Asia, London, NY AM, RTH, or Silver Bullet session fields.
- **Outputs:** only `ICT WEEKLY DELIVERY NOTE`, `ICT DAILY DELIVERY PLAN`, and
  the defined close-only addendum. Do not create a third report format.
- **Data behavior:** Use user/chart values first where supplied. Otherwise,
  derive only fields that are objectively available from the NQ 1-minute
  series. Record missing calendar, contract, structure, or cross-market inputs
  as `TBD` under `DATA GAPS`.
- **Report safety:** Keep the Grok spec's disclaimer, one primary and one
  failed-raid hypothesis, explicit invalidation, and exactly one selected model
  state. `UNDEFINED` structure means `NO TRADE`.

## Data boundaries

- The current NQ continuation has a fixed historical segment and a mutable
  Yahoo `NQ=F` continuation segment. It is suitable for internal operational
  planning but not an immutable research snapshot.
- The database can provide OHLC-derived levels, timestamps, and session ranges;
  it cannot establish an ICT market-structure interpretation, a user-drawn
  order block/FVG, an economic-calendar event, or NQ-versus-ES SMT by itself.
- Preserve the source labeling required by the report spec. Any level without a
  defensible source is `TBD`, not an inferred price.

## First implementation increments

1. Add a read-only NQ data adapter that fetches UTC candles and derives
   New-York-time session levels without writing to SQLite.
2. Add a calendar/input adapter for contract, CME RTH holiday status, and
   red-folder events; unavailable values remain `TBD`.
3. Render the weekly and daily templates verbatim from structured data.
4. Add fixture-based checks for source tags, tick rounding, ET/DST conversion,
   `DATA GAPS`, report heading order, two-hypothesis limit, and one-model rule.
5. Keep every report a dated, reproducible artifact with its NQ data cutoff and
   input sources visible.

## Out of scope

- Automated entries, brokerage connectivity, trade sizing, or performance
  optimization.
- Treating a premium/discount location, a reported level, or an RTH-gap study
  result as a standalone trade recommendation.
- Rewriting historical or mutable NQ price data from this project.
