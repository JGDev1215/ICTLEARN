"""Export a bounded, read-only NQ study window for the static GitHub Pages UI.

The canonical SQLite store is never modified or copied. The exporter calls the
existing Journal chart server's session functions, writes presentation payloads
for explicitly selected dates, and records a SHA-256 digest for every day file.
"""

import argparse
from contextlib import closing
from datetime import date, timedelta
import hashlib
import importlib.util
import json
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[1]
JOURNAL = REPOSITORY.parent
DEFAULT_SERVER = JOURNAL / "prototype" / "ict_chart_server.py"
DEFAULT_DATABASE = JOURNAL / "nq_ohlc_data.db"
DEFAULT_OUTPUT = REPOSITORY / "prototype" / "static-data"
SESSIONS = ("asia", "london", "nyam", "lunch", "nypm", "rth")
TIMEFRAMES = (1, 5)


def load_server(path):
    specification = importlib.util.spec_from_file_location("journal_ict_chart_server", path)
    if not specification or not specification.loader:
        raise RuntimeError(f"Could not load chart server module: {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def compact_json(value):
    return json.dumps(value, allow_nan=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def date_range(start, end):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


def export(args):
    chart = load_server(args.server)
    output = args.output.resolve()
    days_directory = output / "days"
    days_directory.mkdir(parents=True, exist_ok=True)
    prior_paths = set()
    catalog_path = output / "catalog.json"
    if catalog_path.exists():
        try:
            prior_catalog = json.loads(catalog_path.read_text())
            if prior_catalog.get("schema") == "ictlearn.static-session-catalog":
                prior_paths = {entry["path"] for entry in prior_catalog.get("days", {}).values()
                               if isinstance(entry, dict) and isinstance(entry.get("path"), str)}
        except (OSError, json.JSONDecodeError):
            pass
    available = {f"{session}:{timeframe}": [] for session in SESSIONS for timeframe in TIMEFRAMES}
    day_entries = {}

    with closing(chart.connect(args.database)) as connection:
        source_meta = chart.metadata(connection)
        for trading_day in date_range(args.start, args.end):
            sessions = {}
            for session in SESSIONS:
                for timeframe in TIMEFRAMES:
                    payload = chart.session_data(connection, trading_day, session, timeframe)
                    if not payload["bars"]:
                        continue
                    key = f"{session}:{timeframe}"
                    sessions[key] = payload
                    available[key].append(trading_day.isoformat())
            if not sessions:
                continue
            day_payload = {
                "schema": "ictlearn.static-session-day",
                "schemaVersion": 1,
                "date": trading_day.isoformat(),
                "sessions": sessions,
            }
            encoded = compact_json(day_payload)
            relative = f"days/{trading_day.isoformat()}.json"
            (output / relative).write_bytes(encoded)
            day_entries[trading_day.isoformat()] = {
                "path": relative,
                "bytes": len(encoded),
                "sha256": hashlib.sha256(encoded).hexdigest(),
            }

    published_dates = sorted(day_entries)
    if not published_dates:
        raise RuntimeError("No session payloads were generated for the requested range.")
    catalog = {
        "schema": "ictlearn.static-session-catalog",
        "schemaVersion": 1,
        "publicationScope": "Bounded educational study snapshots; full canonical history remains local.",
        "sourceSnapshot": {
            "instrument": "NQ",
            "canonicalTimeframeMinutes": 1,
            "firstSourceUTC": source_meta["firstUTC"],
            "lastSourceUTC": source_meta["lastUTC"],
            "publishedStartDate": published_dates[0],
            "publishedEndDate": published_dates[-1],
        },
        "meta": {
            **source_meta,
            "minDate": published_dates[0],
            "maxDate": published_dates[-1],
            "sessions": [{"id": key, **value} for key, value in chart.SESSIONS.items()],
        },
        "available": available,
        "days": day_entries,
    }
    catalog_path.write_bytes(compact_json(catalog))
    current_paths = {entry["path"] for entry in day_entries.values()}
    for relative in prior_paths - current_paths:
        stale = (output / relative).resolve()
        if stale.parent == days_directory.resolve() and stale.suffix == ".json" and stale.exists():
            stale.unlink()
    return len(day_entries), sum(entry["bytes"] for entry in day_entries.values())


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", "--start-date", dest="start", type=date.fromisoformat, default=date(2026, 8, 17))
    parser.add_argument("--end", "--end-date", dest="end", type=date.fromisoformat, default=date(2026, 9, 4))
    parser.add_argument("--server", type=Path, default=DEFAULT_SERVER)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    count, size = export(arguments)
    print(f"Exported {count} study days ({size:,} JSON bytes) to {arguments.output}")
