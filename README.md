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

## Local full-data mode

From the Journal project root:

```sh
python3 prototype/ict_chart_server.py --port 8768
```

Then open:

<http://127.0.0.1:8768/prototype/ict_notes_demo.html>

The local server reads the NQ database in SQLite read-only mode and aggregates
the optional 5-minute view from the 1-minute rows.
