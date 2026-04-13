#!/usr/bin/env python3
"""Simple static file server with no-cache headers for development."""
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # suppress logs

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    handler = lambda *a, **kw: NoCacheHandler(*a, directory=directory, **kw)
    with http.server.HTTPServer(('', port), handler) as httpd:
        httpd.serve_forever()
