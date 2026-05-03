import os
import re

handlers = {
    "api/auth/login.js": "handleLogin",
    "api/auth/logout.js": "handleLogout",
    "api/auth/me.js": "handleMe",
    "api/auth/signup.js": "handleSignup",
    "api/reader/analytics.js": "handleAnalytics",
    "api/reader/bookmarks.js": "handleBookmarks",
    "api/reader/community.js": "handleCommunity",
    "api/reader/progress.js": "handleProgress",
    "api/reader/reactions.js": "handleReactions",
    "api/upload/avatar.js": "handleAvatar",
    "api/user/profile.js": "handleProfile",
    "api/dashboard.js": "handleDashboard",
}

header = """const { put, del } = require("@vercel/blob");
const pool = require("../lib/api/db");
const { allowCors, success, fail } = require("../lib/api/http");
const { parseJsonBody, getClientIp } = require("../lib/api/request");
const { takeRateLimitToken } = require("../lib/api/rate-limit");
const {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeCookie,
  getSessionCookieOptions,
  makePasswordHash,
  verifyPassword,
  createSession,
  destroySession,
  getSession,
  requireSession,
  validateCsrf,
  shouldExposeSessionToken,
} = require("../lib/api/auth");
const { sendPushToUser, sendPushBroadcast } = require("../lib/api/push");
"""

combined_js = header + "\n"

for filepath, handler_name in handlers.items():
    with open(filepath, "r") as f:
        content = f.read()

    # Remove requires
    content = re.sub(r'const\s+(?:\{[^}]*\}|[a-zA-Z0-9_]+)\s*=\s*require\([^)]+\);', '', content)
    
    # Replace module.exports
    content = content.replace("module.exports = async (req, res) => {", "return async (req, res) => {")
    
    # Wrap in IIFE
    wrapped = f"exports.{handler_name} = (() => {{\n{content}\n}})();\n\n"
    combined_js += wrapped

with open("api/_handlers.js", "w") as f:
    f.write(combined_js)

# Now, create the proxy files
for filepath, handler_name in handlers.items():
    with open(filepath, "w") as f:
        # e.g., if filepath is api/auth/login.js, we need to require ../_handlers
        # if filepath is api/dashboard.js, we need to require ./_handlers
        parts = filepath.split('/')
        depth = len(parts) - 2
        prefix = "../" * depth if depth > 0 else "./"
        
        f.write(f"module.exports = require('{prefix}_handlers').{handler_name};\n")

print("Successfully combined 12 API files into api/_handlers.js and updated the original files.")
