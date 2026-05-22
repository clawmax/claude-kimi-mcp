#!/usr/bin/env bash
# 从 .env 文件加载环境变量后启动 MCP Server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
else
  echo "[kimi-agent-mcp] 错误: 未找到 .env 文件，请先执行: cp .env.example .env 并填入 KIMI_API_KEY" >&2
  exit 1
fi

# dist 不存在时自动构建
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
  echo "[kimi-agent-mcp] 首次运行，正在构建..." >&2
  (cd "$SCRIPT_DIR" && npm run build) >&2
fi

exec node "$SCRIPT_DIR/dist/index.js"
