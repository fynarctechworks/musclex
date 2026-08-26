import http.server, os, sys
ROOT = sys.argv[1]; PORT = int(sys.argv[2])
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        p = self.translate_path(self.path)
        # SPA fallback: unknown, extension-less paths serve index.html so
        # client-side routes resolve.
        if not os.path.exists(p) and not os.path.splitext(self.path)[1]:
            self.path = '/index.html'
        return super().do_GET()
    def log_message(self,*a): pass
http.server.HTTPServer(('127.0.0.1', PORT), H).serve_forever()
