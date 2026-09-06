# ICT Learn

Chart-led ICT study guide for comparing NQ sessions and recognising repeated
price behaviour, timing, and confluence.

## Hosted demo

The GitHub Pages entry point is `index.html`, which opens
`prototype/ict_notes_demo.html`.

The hosted page is a static visual demo using the embedded example snapshot.
It includes the chart layers, 1-minute/5-minute selector, playback, manual
drawings, notes, and comparison overlay. GitHub Pages cannot run the project's
Python chart server or access the local SQLite market database, so full
date/session navigation remains available through the local server described
in `prototype/ICT_CHART_README.md`.

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

See [`docs/ADR-001-lightweight-charts-migration.md`](docs/ADR-001-lightweight-charts-migration.md)
for the migration stages, acceptance gates, and rollback path.

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
