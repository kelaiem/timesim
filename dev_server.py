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


class Server(http.server.ThreadingHTTPServer):
    # socketserver's default accept backlog is 5, and that is what caps the
    # battery's shard count — not CPU. Each sharded browser context cold-loads
    # the whole module graph at once, so K browsers open far more than 5
    # near-simultaneous connections; the listen queue overflows and the kernel
    # RESETS the excess. Measured at K=6 on a 12-core M2 Max: shard 4 never
    # reached __clock, three ERR_CONNECTION_RESET and no __bootWarns at all,
    # while the other five shards ran clean. The dead-shard gate caught it
    # (that is what it is for), but the cause was here, not in the harness.
    request_queue_size = 128


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='timesim dev server')
    ap.add_argument('port', nargs='?', type=int,
                    default=int(os.environ.get('PORT', 8347)))
    # Loopback is the default on purpose: /__state accepts PUT and DELETE, so
    # any host that can reach the port can overwrite or clear the saved sim
    # state. Opt in to other machines (a phone on the LAN, a VM guest reaching
    # the host's checkout) with --host 0.0.0.0 or HOST=0.0.0.0 — a trusted
    # network only.
    ap.add_argument('--host', default=os.environ.get('HOST', '127.0.0.1'),
                    help='interface to bind (default 127.0.0.1; 0.0.0.0 for all)')
    args = ap.parse_args()
    shown = 'localhost' if args.host in ('0.0.0.0', '') else args.host
    print(f'timesim dev server on http://{shown}:{args.port}  (bound to {args.host}, '
          f'state file: {STATE_PATH})')
    Server((args.host, args.port), Handler).serve_forever()
