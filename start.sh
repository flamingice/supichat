#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
CONFIG_FILE=".supichat.env"; [ -f "$CONFIG_FILE" ] && . "$CONFIG_FILE"
RUN_AS=${RUN_AS_USER:-}
WEB_PORT=${WEB_PORT:-3000}
SIGNALING_PORT=${SIGNALING_PORT:-4001}
BASE_PATH=${BASE_PATH:-/supichat}

# Ensure nginx is running
if ! systemctl is-active --quiet nginx; then
  (sudo systemctl start nginx || true)
fi

run_pm2() {
  if [ "$(id -u)" = "0" ] && [ -n "$RUN_AS" ] && [ "$RUN_AS" != "root" ]; then
    # Ensure node path for target user
    sudo -u "$RUN_AS" -H env PATH="/usr/bin:/usr/local/bin:$PATH" pm2 "$@"
  else
    env PATH="/usr/bin:/usr/local/bin:$PATH" pm2 "$@"
  fi
}

pushd services/signaling >/dev/null
PORT="$SIGNALING_PORT" run_pm2 start server.js --name supichat-signaling --update-env
popd >/dev/null

pushd apps/web >/dev/null
STANDALONE_SERVER=""
if compgen -G ".next/standalone/*/server.js" > /dev/null; then
  STANDALONE_SERVER=$(ls -1 .next/standalone/*/server.js | head -n1)
elif [ -f ".next/standalone/server.js" ]; then
  STANDALONE_SERVER=".next/standalone/server.js"
fi

if [ -n "$STANDALONE_SERVER" ]; then
  PORT="$WEB_PORT" run_pm2 start "$STANDALONE_SERVER" --name supichat-web --update-env
elif [ -x node_modules/.bin/next ]; then
  run_pm2 start node_modules/next/dist/bin/next --name supichat-web -- start -p "$WEB_PORT"
else
  run_pm2 start npm --name supichat-web -- start
fi
popd >/dev/null
run_pm2 save
run_pm2 status

HOST=${SUPICHAT_HOST:-$(curl -fsS ifconfig.me || curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}' || echo localhost)}

echo "\nSupiChat URL:  http://$HOST:${WEB_PORT}$BASE_PATH"
echo "Signaling:    http://$HOST:${SIGNALING_PORT}/health"

# Optional service check
[ -x ./check-services.sh ] && ./check-services.sh || true
