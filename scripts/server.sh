#!/usr/bin/env bash
set -euo pipefail

PORT=4096
PID_FILE="/tmp/portal-web.pid"
LOG_FILE="/tmp/portal-web.log"

# Resolve repo root from this script's location so it works from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"

port_pids() {
  lsof -ti "tcp:$PORT" 2>/dev/null || true
}

is_running() {
  [ -n "$(port_pids)" ]
}

stop() {
  local pids
  pids="$(port_pids)"

  if [ -f "$PID_FILE" ]; then
    pids="$pids $(cat "$PID_FILE" 2>/dev/null || true)"
  fi

  pids="$(echo "$pids" | tr ' ' '\n' | sort -u | grep -v '^$' || true)"

  if [ -z "$pids" ]; then
    echo "No server running on port $PORT."
    rm -f "$PID_FILE"
    return 0
  fi

  echo "Stopping server (PIDs: $(echo "$pids" | tr '\n' ' '))..."
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true

  # Wait up to 5s for graceful shutdown, then force kill.
  for _ in 1 2 3 4 5; do
    is_running || break
    sleep 1
  done

  if is_running; then
    echo "Force killing remaining processes..."
    # shellcheck disable=SC2086
    kill -9 $(port_pids) 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  echo "Stopped."
}

start() {
  if is_running; then
    echo "Port $PORT already in use. Stopping existing server first..."
    stop
  fi

  echo "Starting server on port $PORT..."
  cd "$WEB_DIR"
  PORT="$PORT" nohup bun run preview > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "Started (PID: $(cat "$PID_FILE"))."
  echo "Logs: $LOG_FILE"
}

status() {
  if is_running; then
    echo "Server is RUNNING on port $PORT (PIDs: $(port_pids | tr '\n' ' '))."
    [ -f "$PID_FILE" ] && echo "PID file: $PID_FILE ($(cat "$PID_FILE"))"
    echo "Logs: $LOG_FILE"
  else
    echo "Server is STOPPED (port $PORT free)."
  fi
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
