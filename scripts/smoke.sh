#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:3000/supichat"

echo "[1] GET base page" && curl -fsS "$BASE" >/dev/null && echo " OK"
echo "[2] GET health" && curl -fsS "$BASE/api/health" | jq -r '.status' | grep -q '^ok$' && echo " OK"

echo "[3] POST room create" && ROOM=$(curl -fsS -X POST "$BASE/api/room/create" | jq -r .id) && test -n "$ROOM" && echo " id=$ROOM"

if [ -n "${DEEPL_API_KEY:-}" ]; then
  echo "[4] POST translate en->de" && curl -fsS -H 'Content-Type: application/json' \
    -d '{"text":"Hello","targetLang":"DE"}' "$BASE/api/translate" \
    | jq -r .translated | grep -qi 'hallo' && echo " OK"
else
  echo "[4] Skipping translate test (DEEPL_API_KEY not set)"
fi

echo "[5] Signaling health" && curl -fsS http://localhost:4001/health | jq -r '.status' | grep -q '^ok$' && echo " OK"

echo "All smoke checks passed."


