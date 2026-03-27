from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import requests
import json
import base64
import html

OAUTH_JSON_PATH="./oauth.json"

with open(OAUTH_JSON_PATH, mode="r") as oauth_json:
    oauth_data = json.load(oauth_json)

CLIENT_ID = oauth_data["CLIENT_ID"]
CLIENT_SECRET = oauth_data["CLIENT_SECRET"]
VALID_SCOPES_STRING = html.escape(" ".join(oauth_data["VALID_SCOPES"]))
AUTH_URL = "https://www.zooniverse.org/oauth/authorize"
TOKEN_URL = "https://panoptes.zooniverse.org/oauth/token"
REDIRECT_URI = "http://localhost:8080/callback"

# note that this endpoind doesn't really exist - it relies on the react frontend forwarding unknown
# routes to index.
SPA_URL = "http://localhost:5173/auth/callback"

class Handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)

        # ---------------------------------------------------------------------
        # 1) Start OAuth workflow by redirecting entire browser window
        # ---------------------------------------------------------------------
        if parsed.path == "/auth-start":
            auth_redirect = (
                f"{AUTH_URL}?"
                f"response_type=code&client_id={CLIENT_ID}"
                f"&redirect_uri={REDIRECT_URI}&scope={VALID_SCOPES_STRING}"
            )
            self.send_response(302)
            self.send_header("Location", auth_redirect)
            self.end_headers()
            return

        # ---------------------------------------------------------------------
        # 2) Receive OAuth callback
        # ---------------------------------------------------------------------
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
                }
            )

            tokens = token_res.json()
            encoded = base64.urlsafe_b64encode(
                json.dumps(tokens).encode()
            ).decode()

            # Send token back to SPA via fragment (more secure)
            redirect_with_token = f"{SPA_URL}#token={encoded}"

            self.send_response(302)
            self.send_header("Location", redirect_with_token)
            self.end_headers()
            return

        self.send_error(404)


print("OAuth backend running on http://localhost:8080")
HTTPServer(("localhost", 8080), Handler).serve_forever()