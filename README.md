# ICT Learn

Chart-led ICT study guide for comparing NQ sessions and recognising repeated
price behaviour, timing, and confluence.

## Hosted demo

The GitHub Pages entry point is `index.html`, which opens
`prototype/ict_notes_demo.html`.

The hosted page includes bounded, precomputed study snapshots for 15 trading
days from 2026-08-17 through 2026-09-04. The calendar, Previous, Next and Latest
controls work across those published dates for all six sessions at 1-minute and
5-minute resolution. Compare day uses the same published window. Playback,
manual drawings, notes and chart layers continue to work without a server.

GitHub Pages cannot run the project's Python chart server or access the local
SQLite market database. The published JSON files are educational snapshots,
not the canonical archive. Full date navigation across the local 2010-2026 NQ
history remains available through the read-only server described in
`prototype/ICT_CHART_README.md`.

The page now defaults to the interactive candlestick renderer with crosshair,
zoom, pan, replay and study overlays. The preserved SVG study chart remains
available through the Renderer control or `?renderer=svg` as the rollback path.
The chart library is pinned inside the repository, so the page makes no CDN
request. Both renderers consume the same replay-limited chart scene.

## Local full-data mode

From the Journal project root:

```sh
python3 prototype/ict_chart_server.py --port 8768
```

Then open:

<http://127.0.0.1:8768/prototype/ict_notes_demo.html>

The local server reads the NQ database in SQLite read-only mode and aggregates
the optional 5-minute view from the 1-minute rows.

To rebuild the bounded GitHub Pages snapshots from the canonical read-only
database, run from this repository:

```sh
python3 tools/export_static_sessions.py \
  --start-date 2026-08-17 \
  --end-date 2026-09-04
```

The exporter writes one checksummed file per trading day plus
`prototype/static-data/catalog.json`. It does not modify the database.

See [`docs/ADR-001-lightweight-charts-migration.md`](docs/ADR-001-lightweight-charts-migration.md)
for the migration stages, acceptance gates, and rollback path.
The latest implementation and scope audit is recorded in
[`docs/AUDIT-002-static-navigation-and-scope.md`](docs/AUDIT-002-static-navigation-and-scope.md).

## Validation

Install the pinned browser-test dependency, then run the unit and static browser
checks:

```sh
npm install
npx playwright install chromium
npm test
```

When the Journal read-only chart server is already running, validate its real
1-minute and 5-minute responses through the same scene adapter:

```sh
ICT_API_BASE=http://127.0.0.1:8768 npm run test:api
```

The Python server and SQLite database are intentionally maintained in the
parent Journal workspace, outside this public static repository.
