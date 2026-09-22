#!/bin/sh
set -eu

cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

cd /app/frontend
node server.js
