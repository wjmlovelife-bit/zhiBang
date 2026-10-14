#!/usr/bin/env bash
# 按 reqId 追踪一次请求的全链路日志
# 用法:
#   ./scripts/tail-logs.sh                       # 实时 tail 今天日志
#   ./scripts/tail-logs.sh srv-5db3e773-...     # grep reqId 全链路

set -e
LOGS_DIR="$(cd "$(dirname "$0")/../backend/logs" && pwd)"
TODAY=$(date +%Y-%m-%d)
# pino-roll 默认命名: zhibang.yyyy-MM-dd.N.log
LATEST=$(ls -t "$LOGS_DIR"/zhibang.*.log 2>/dev/null | head -1 || echo "")

if [ -n "$1" ]; then
    echo "=== Grep reqId=$1 ==="
    grep -E "\"reqId\":\"$1\"|\\[req=$1\\]" "$LOGS_DIR"/zhibang.*.log 2>/dev/null | tail -50
    echo
    echo "=== Total: $(grep -c "$1" "$LOGS_DIR"/zhibang.*.log 2>/dev/null | awk -F: '{s+=$2}END{print s+0}') lines ==="
elif [ -n "$LATEST" ]; then
    echo "=== Real-time tail $LATEST ==="
    tail -f "$LATEST" | while read -r line; do
        # 简单格式化：level + reqId + context + msg
        echo "$line" | python -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    lvl = d.get('level', 0)
    name = {10:'TRC',20:'DBG',30:'INF',40:'WRN',50:'ERR',60:'FAL'}.get(lvl, str(lvl))
    print(f\"[{name}] {d.get('reqId','-'):>40} {d.get('context',''):<20} {d.get('msg','')}\")
except Exception:
    print(sys.stdin.read().rstrip())
" 2>/dev/null || echo "$line"
    done
else
    echo "No log file found in $LOGS_DIR"
    exit 1
fi