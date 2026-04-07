from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlencode, urlparse
from pathlib import Path
import json
import requests

# -------------------------------------------------------
# Load configuration
# -------------------------------------------------------
_CONFIG_PATH = Path(__file__).resolve().parent / "oauth.json"

with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)

CLIENT_ID = config["CLIENT_ID"]
CLIENT_SECRET = config["CLIENT_SECRET"]
REDIRECT_URI = config["REDIRECT_URI"]  # Must match Doorkeeper registration
VALID_SCOPES = config["VALID_SCOPES"]

AUTH_URL = "https://www.zooniverse.org/oauth/authorize"
TOKEN_URL = "https://panoptes.zooniverse.org/oauth/token"

# Your SPA (React app) origin
ALLOWED_ORIGIN = "http://localhost:5173"


# -------------------------------------------------------
# Backend HTTP Handler
# -------------------------------------------------------
class Handler(BaseHTTPRequestHandler):

    # -----------------------------
    # Utility: Add CORS headers
    # -----------------------------
    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # -----------------------------
    # Required for CORS preflight
    # -----------------------------
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    # -----------------------------
    # GET Requests
    # -----------------------------
    def do_GET(self):
        parsed = urlparse(self.path)

        # 1. SPA → /auth-start → redirect to Zooniverse OAuth page
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

        # 2. Optional informational callback page (not used by SPA)
        if parsed.path == "/callback":
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
                <html>
                    <body>
                        <h2>Authentication complete.</h2>
                        <p>You may now return to your application.</p>
                    </body>
                </html>
            """)
            return

        # Unknown route
        self.send_error(404)

    # -----------------------------
    # POST: SPA sends code for exchange or refresh
    # -----------------------------
    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/oauth/exchange":

            # Read JSON body
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_len).decode())
            except Exception:
                self.send_error(400, "Invalid JSON")
                return

            code = body.get("code")
            if not code:
                self.send_error(400, "Missing authorization code")
                return

            # Exchange code for tokens (confidential client)
            token_res = requests.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "redirect_uri": REDIRECT_URI,
                }
            )

            tokens = token_res.json()
            print(f"[oauth_server] Token exchange response: {tokens}")

            # Return tokens to the SPA
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(tokens).encode())
            return

        elif parsed.path == "/oauth/refresh":

            # Read JSON body
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_len).decode())
            except Exception:
                self.send_error(400, "Invalid JSON")
                return

            refresh_token = body.get("refresh_token")
            if not refresh_token:
                self.send_error(400, "Missing refresh token")
                return

            # Exchange refresh token for new access token
            token_res = requests.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                }
            )

            if token_res.status_code != 200:
                print(f"[oauth_server] Token refresh failed: {token_res.status_code} {token_res.text}")
                self.send_error(401, "Token refresh failed")
                return

            tokens = token_res.json()
            print(f"[oauth_server] Token refresh response: {tokens}")

            # Return new tokens to the SPA
            self.send_response(200)
            self._set_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(tokens).encode())
            return

        self.send_error(404)

    # Quiet logs
    def log_message(self, fmt, *args):
        print(f"[oauth_server] {args[0]}")


# -------------------------------------------------------
# Startup
# -------------------------------------------------------
if __name__ == "__main__":
    print(f"OAuth backend running at http://localhost:8080")
    print(f"Config loaded from: {_CONFIG_PATH}")
    HTTPServer(("localhost", 8080), Handler).serve_forever()