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
    sudo -u "$RUN_AS" -H pm2 "$@"
  else
    pm2 "$@"
  fi
}

pushd apps/web >/dev/null
npm run build
STANDALONE_SERVER=""
if compgen -G ".next/standalone/*/server.js" > /dev/null; then
  STANDALONE_SERVER=$(ls -1 .next/standalone/*/server.js | head -n1)
elif [ -f ".next/standalone/server.js" ]; then
  STANDALONE_SERVER=".next/standalone/server.js"
fi

if [ -n "$STANDALONE_SERVER" ]; then
  if ! run_pm2 restart supichat-web; then
    PORT="$WEB_PORT" run_pm2 start "$STANDALONE_SERVER" --name supichat-web --update-env
  fi
else
  if ! run_pm2 restart supichat-web; then
    if [ -x node_modules/.bin/next ]; then
      run_pm2 start node_modules/next/dist/bin/next --name supichat-web -- start -p "$WEB_PORT"
    else
      run_pm2 start npm --name supichat-web -- start
    fi
  fi
fi
popd >/dev/null

pushd services/signaling >/dev/null
if ! run_pm2 restart supichat-signaling; then
  # Start signaling via npm to avoid absolute path issues under /root
  PORT="$SIGNALING_PORT" run_pm2 start npm --name supichat-signaling -- start
fi
popd >/dev/null
run_pm2 save

HOST=${SUPICHAT_HOST:-$(curl -fsS ifconfig.me || curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}' || echo localhost)}

echo "\nSupiChat URL:  http://$HOST:${WEB_PORT}$BASE_PATH"
echo "Signaling:    http://$HOST:${SIGNALING_PORT}/health"

# Optional service check
[ -x ./check-services.sh ] && ./check-services.sh || true
