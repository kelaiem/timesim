#!/usr/bin/env python3
"""Static dev server + tiny state endpoint.

Serves the repo like `python3 -m http.server`, with two additions:

* /__state — GET/PUT/DELETE a JSON blob persisted in a TEMP FILE
  (<tempdir>/timesim-state.json), so the simulation's state survives page
  refreshes and browser restarts. Used by src/state.js, which falls back to
  localStorage when this endpoint is absent (plain static server).

* Cache-Control: no-store on every response — browsers aggressively cache
  ES-module sub-imports (geometry.js, aesthetics.json, ...) and won't
  revalidate them on reload, which serves stale code after edits.
"""
import http.server
import json
import os
import sys
import tempfile

STATE_PATH = os.path.join(tempfile.gettempdir(), 'timesim-state.json')


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path == '/__state':
            if os.path.exists(STATE_PATH):
                with open(STATE_PATH, 'rb') as f:
                    body = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_error(404, 'no saved state')
            return
        super().do_GET()

    def do_PUT(self):
        if self.path != '/__state':
            return self.send_error(405)
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n)
        try:
            json.loads(body)  # only well-formed JSON reaches the file
        except ValueError:
            return self.send_error(400, 'body is not JSON')
        with open(STATE_PATH, 'wb') as f:
            f.write(body)
        self.send_response(204)
        self.end_headers()

    def do_DELETE(self):
        if self.path != '/__state':
            return self.send_error(405)
        try:
            os.remove(STATE_PATH)
        except FileNotFoundError:
            pass
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8347))
    print(f'timesim dev server on http://127.0.0.1:{port}  (state file: {STATE_PATH})')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
