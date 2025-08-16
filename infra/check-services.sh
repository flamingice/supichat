#!/usr/bin/env bash
set -euo pipefail

echo "[check] nginx status:"; (systemctl is-active --quiet nginx && echo running) || (echo starting && sudo systemctl start nginx || true)

if command -v pm2 >/dev/null 2>&1; then
  if pm2 ping >/dev/null 2>&1; then
    echo "[check] pm2: running"
  else
    echo "[check] pm2: starting via resurrect"
    pm2 resurrect || true
  fi
  pm2 status || true
else
  echo "[check] pm2 not installed"
fi


