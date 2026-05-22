#!/usr/bin/env bash
# Load environment variables from .env then start the MCP server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
else
  echo "[claude-kimi-mcp] Error: .env file not found. Run: cp .env.example .env and set KIMI_API_KEY" >&2
  exit 1
fi

# Auto-build on first run if dist/ is missing
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
  echo "[claude-kimi-mcp] First run: building..." >&2
  (cd "$SCRIPT_DIR" && npm run build) >&2
fi

exec node "$SCRIPT_DIR/dist/index.js"
