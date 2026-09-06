# ICT chart preview

Run from the Journal project root:

```sh
python3 prototype/ict_chart_server.py --port 8768
```

Open <http://127.0.0.1:8768/prototype/ict_notes_demo.html>.

The calendar chooses the trading date. Arrows move to the next/previous date
with complete candles for the selected session; Latest jumps to its latest
available date. The session selector offers Asia, London, NY AM, NY lunch,
NY PM and RTH, using the project's New York time windows. Asia starts on the
calendar evening before its trading date.

Date/session/timeframe choices are included in the URL. The chart defaults to
one-minute OHLC candles; the optional five-minute view is aggregated from the
same one-minute rows. Candles, range references, price scale, playback and the
candidate illustration refresh together.
The Renderer control defaults to the Lightweight Charts view with candlesticks,
crosshair, zoom and pan. The preserved SVG chart is selected by `?renderer=svg`
and remains the automatic rollback path. The interactive view uses a vendored
5.2.0 standalone build and makes no CDN request. If it cannot initialize, the
page restores the SVG renderer and shows the reason.
Use Compare day to overlay a second date/session as a dashed close path
normalized to that study day's opening price. This is a visual pattern-review
aid rather than a price-level signal; the selected comparison is also stored
in the URL so a study view can be revisited.
Manual drawings are retained separately by date/session for the current
page visit. Journal notes use the existing browser storage key; keep the
same hostname and port to access existing drafts.

The server binds only to 127.0.0.1 and opens the linked NQ database using
SQLite mode=ro and PRAGMA query_only. It exposes GET-only history endpoints
and a small allowlist of demo/source files. The market database is never
copied or modified. Dates outside source coverage return an error; empty
windows show an empty chart, and incomplete five-minute buckets are omitted
without compressing the time axis.

The API labels the fixed Databento history and the mutable Yahoo `NQ=F`
continuation separately. A source-boundary marker is drawn when it falls
inside the selected session; the footer and Data & sources panel report the
one-minute source-row counts behind the displayed candles.

The previous-range comparator is the most recent elapsed, non-overlapping
canonical session with observations within 14 preceding days. Asterisks
mark partial observed ranges. This UI choice does not change report or
scheduler policy. RTH is an optional separate comparison.

The candidate FVG is a mechanical three-complete-candle gap illustration,
not a validated first-presented FVG or trade signal. Its selection rule and
source details are available under Data & sources.

When served through GitHub Pages or another HTTP server, the page first looks
for the local API. When the API is unavailable, it loads the published static
catalog. That catalog currently covers 15 trading days from 2026-08-17 through 2026-09-04,
all six sessions, and both 1-minute and 5-minute candles. Calendar selection,
Previous, Next, Latest and Compare day work inside that bounded window. If both
sources are unavailable, the saved 2026-09-04 NY AM example remains as the
last-resort chart and navigation is disabled. Direct `file://` opening cannot
fetch the JSON catalog under normal browser security rules, so use the hosted
page or local server for date navigation.

The static files are derived educational snapshots. The full canonical history
and mutable continuation source remain local. Rebuild the published window from
the `ICTLEARN` repository without writing to the market database:

```sh
python3 tools/export_static_sessions.py \
  --start-date 2026-08-17 \
  --end-date 2026-09-04
```

The server and its Python tests belong to the parent Journal workspace; they are
not duplicated in this public static repository. From the Journal root, run:

```sh
python3 -m unittest discover -s prototype -p test_ict_chart_server.py -v
```

From the `ICTLEARN` repository, run the renderer checks with `npm test`. With
the Journal server running on port 8768, add
`ICT_API_BASE=http://127.0.0.1:8768 npm run test:api` to exercise its real
1-minute and 5-minute responses through the chart-scene adapter.
