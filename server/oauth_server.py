from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
from pathlib import Path
import json
import requests

_CONFIG_PATH = Path(__file__).resolve().parent / "oauth.json"

with open(_CONFIG_PATH, "r", encoding="utf-8") as oauth_json:
    oauth_data = json.load(oauth_json)

CLIENT_ID = oauth_data["CLIENT_ID"]
CLIENT_SECRET = oauth_data["CLIENT_SECRET"]
VALID_SCOPES = oauth_data["VALID_SCOPES"]
REDIRECT_URI = oauth_data["REDIRECT_URI"]

AUTH_URL = "https://www.zooniverse.org/oauth/authorize"
TOKEN_URL = "https://panoptes.zooniverse.org/oauth/token"

class Handler(BaseHTTPRequestHandler):

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        # SPA → /auth-start → redirect to Zooniverse OAuth
        if parsed.path == "/auth-start":
            params = {
                "response_type": "code",
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "scope": " ".join(VALID_SCOPES),
            }
            auth_redirect = f"{AUTH_URL}?{urlencode(params)}"
            self.send_response(302)
            self._set_cors()
            self.send_header("Location", auth_redirect)
            self.end_headers()
            return

        # Optional: if user hits backend callback directly
        if parsed.path == "/callback":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self._set_cors()
            self.end_headers()
            self.wfile.write(b"""
                <html>
                    <body>
                        <p>Authentication complete. Return to your application.</p>
                    </body>
                </html>
            """)
            return

        self.send_error(404)

    # NEW: SPA sends code → backend exchanges it → backend returns tokens
    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/oauth/exchange":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len)
            data = json.loads(body.decode())

            code = data.get("code")
            if not code:
                self.send_error(400, "Missing authorization code")
                return

            token_res = requests.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": REDIRECT_URI,
                    "client_id": CLIENT_ID,
                    # "client_secret": CLIENT_SECRET,
                },
            )

            tokens = token_res.json()

            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(tokens).encode())
            return

        self.send_error(404)

    def log_message(self, fmt, *args):
        print(f"[oauth_server] {args[0]}")

print(f"OAuth backend running at http://localhost:8080")
HTTPServer(("localhost", 8080), Handler).serve_forever()