from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
import requests
import json
import base64

_CONFIG_PATH = Path(__file__).resolve().parent / "oauth.json"

with open(_CONFIG_PATH, mode="r", encoding="utf-8") as oauth_json:
    oauth_data = json.load(oauth_json)

CLIENT_ID = oauth_data["CLIENT_ID"]
CLIENT_SECRET = oauth_data["CLIENT_SECRET"]
VALID_SCOPES = oauth_data["VALID_SCOPES"]
# Optional in older configs; prefer value from oauth.json
REDIRECT_URI = oauth_data.get("REDIRECT_URI", "http://localhost:8080/callback")

AUTH_URL = "https://www.zooniverse.org/oauth/authorize"
TOKEN_URL = "https://panoptes.zooniverse.org/oauth/token"

# After token exchange, send tokens to the SPA via fragment.
SPA_URL = "http://localhost:5173/auth/callback"

# NOTE: REDIRECT_URI must match the OAuth application registration in Zooniverse.
# - For this dev server, use "http://localhost:8080/callback" so the browser returns
#   to /callback?code=... and the handler can exchange the code automatically.
# - "urn:ietf:wg:oauth:2.0:oob" is the out-of-band flow: Zooniverse shows a code on a
#   page instead of redirecting here; this script's /callback route will not run unless
#   you switch to an http(s) redirect URI in both oauth.json and the app settings.


class Handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/auth-start":
            params = {
                "response_type": "code",
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "scope": " ".join(VALID_SCOPES),
            }
            auth_redirect = f"{AUTH_URL}?{urlencode(params)}"
            self.send_response(302)
            self.send_header("Location", auth_redirect)
            self.end_headers()
            return

        if parsed.path == "/callback":
            code = parse_qs(parsed.query).get("code", [None])[0]
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
                    "client_secret": CLIENT_SECRET,
                },
            )

            tokens = token_res.json()
            encoded = base64.urlsafe_b64encode(
                json.dumps(tokens).encode()
            ).decode()

            redirect_with_token = f"{SPA_URL}#token={encoded}"

            self.send_response(302)
            self.send_header("Location", redirect_with_token)
            self.end_headers()
            return

        self.send_error(404)

    def log_message(self, format, *args):
        # Quieter default logging
        print(f"[oauth_server] {args[0]}")


print(f"OAuth backend running on http://localhost:8080 (config: {_CONFIG_PATH})")
HTTPServer(("localhost", 8080), Handler).serve_forever()
