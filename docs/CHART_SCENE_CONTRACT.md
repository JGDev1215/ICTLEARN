# Chart scene contract

`prototype/chart_scene_adapter.js` converts an existing session response and UI state into `ictlearn.chart-scene` version 1. The scene is presentation-neutral: the SVG baseline and Lightweight Charts preview receive the same observed inputs.

The contract contains:

- `instrument`, `session`, `timeframeMinutes`, `displayTimezone`, and the exact API window;
- `replay`, including the selected index and last visible timestamp;
- `candles`, limited to complete observed bars at or before the replay cursor;
- `missingSlots`, with no replacement or interpolation;
- `referenceLevels`, candidate `fvgCandidates`, timing `macros`, manual drawings, and comparison data only when their layer is enabled and available;
- `annotations` for RTH open and an in-window source boundary;
- `sourceProvenance`, copied from the session response rather than inferred by the renderer.

Every candle uses a Unix timestamp in seconds for the chart library plus the original ISO timestamp for audit. Prices are passed through without rounding; display formatting may round to the instrument tick.

The adapter rejects invalid OHLC rows, unsorted timestamps, invalid cursors, and unsupported timeframes. A renderer must treat rejection as a data error and use the preserved SVG fallback rather than repairing the input.

Candidate FVGs remain review objects. Their bounds and formation index come from the existing detector; the scene does not add qualification, probability, or trade direction.

Comparison closes are normalized as percentage change from that comparison's
open. When the comparison session has more observations than the active
session, the adapter keeps the last observed close mapped to each active slot.
The scene records this as `last-observed-close-per-active-slot`; the chart does
not present the resampled path as an executable price series.
