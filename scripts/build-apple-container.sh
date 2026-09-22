#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD_DIR="$PROJECT_DIR/work/apple-container-build"

mkdir -p "$BUILD_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .venv \
  --exclude __pycache__ \
  "$PROJECT_DIR/Dockerfile" \
  "$PROJECT_DIR/frontend" \
  "$PROJECT_DIR/backend" \
  "$PROJECT_DIR/shared" \
  "$PROJECT_DIR/scripts" \
  "$BUILD_DIR/"

cd "$BUILD_DIR"
container build -t vector-commander:local .
