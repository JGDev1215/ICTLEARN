#!/usr/bin/env python3
"""Serve the canonical ICTLEARN chart with read-only Journal NQ history.

Run from the ICTLEARN repository:
    python3 tools/serve_local_chart.py --port 8768

The API implementation and database contract remain in the parent Journal
workspace. This adapter only selects the current repository's chart assets so
the local full-history view cannot drift to an older HTML copy.
"""

import argparse
from contextlib import closing
import importlib.util
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse


REPOSITORY = Path(__file__).resolve().parents[1]
JOURNAL = REPOSITORY.parent
DEFAULT_SERVER = JOURNAL / "prototype" / "ict_chart_server.py"
DEFAULT_DATABASE = JOURNAL / "nq_ohlc_data.db"
ALLOWED_PREFIXES = ("prototype/", "sources/")


def load_chart_server(path):
    specification = importlib.util.spec_from_file_location("journal_ict_chart_server", path)
    if not specification or not specification.loader:
        raise RuntimeError(f"Could not load Journal chart server: {path}")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def safe_asset(request_path):
    """Return a bounded repository asset path, or None for disallowed paths."""
    relative = unquote(request_path).lstrip("/")
    if not relative:
        relative = "prototype/ict_notes_demo.html"
    if not relative.startswith(ALLOWED_PREFIXES):
        return None
    candidate = (REPOSITORY / relative).resolve()
    try:
        candidate.relative_to(REPOSITORY)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def build_handler(chart, database):
    class LocalChartHandler(chart.Handler):
        def do_GET(self):
            request = urlparse(self.path)
            if request.path.startswith("/api/ict/"):
                return super().do_GET()
            if request.path == "/favicon.ico":
                self.send_response(204)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            asset = safe_asset(request.path)
            if asset is None:
                return self.send_error(404)
            payload = asset.read_bytes()
            content_type = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
            if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"}:
                content_type += "; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, _format, *_args):
            return

    LocalChartHandler.database = database
    return LocalChartHandler


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8768)
    parser.add_argument("--server", type=Path, default=DEFAULT_SERVER)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    return parser.parse_args()


def main():
    args = parse_args()
    chart = load_chart_server(args.server.resolve())
    database = args.database.resolve()
    with closing(chart.connect(database)) as connection:
        meta = chart.metadata(connection)
        if connection.execute("PRAGMA query_only").fetchone()[0] != 1:
            raise RuntimeError("NQ database connection is not read-only.")
    handler = build_handler(chart, database)
    server = chart.ThreadingHTTPServer((args.host, args.port), handler)
    host, port = server.server_address[:2]
    print(
        f"Chart preview: http://{host}:{port}/prototype/ict_notes_demo.html "
        f"(NQ {meta['minDate']} to {meta['maxDate']}, read-only)",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
