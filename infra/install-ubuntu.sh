#!/usr/bin/env bash
set -euo pipefail

# SupiChat Ubuntu install script (rootless)
# - Installs Node.js and PM2 for process management
# - Sets up env files and start/stop scripts

CONFIG_FILE=".supichat.env"

prompt() {
  local msg="$1"; shift || true
  local def="${1:-}"; shift || true
  local var
  if [ -n "$def" ]; then
    read -r -p "$msg [$def]: " var || true
    echo "${var:-$def}"
  else
    read -r -p "$msg: " var || true
    echo "$var"
  fi
}

mask() { local v="$1"; [ -z "$v" ] && echo "" && return; local n=${#v}; [ $n -le 4 ] && echo "****" || echo "${v:0:2}****${v: -2}"; }

set_kv() {
  # set_kv FILE KEY VALUE
  local f="$1" k="$2" v="$3"
  if grep -q "^${k}=" "$f" 2>/dev/null; then
    sed -i "s|^${k}=.*$|${k}=${v}|" "$f"
  else
    printf "\n%s=%s\n" "$k" "$v" >> "$f"
  fi
}

if ! command -v curl >/dev/null 2>&1; then
  echo "Installing curl...";
  sudo apt-get update -y && sudo apt-get install -y curl ca-certificates
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js LTS...";
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential
fi

# Ensure node/npm are executable for all users (avoid EACCES for non-root pm2)
if [ -x /usr/bin/node ]; then sudo chmod 755 /usr/bin/node || true; fi
if [ -x /usr/bin/npm ]; then sudo chmod 755 /usr/bin/npm || true; fi

echo "Installing pm2 globally..."
sudo npm install -g pm2 || npm install -g pm2

echo "Installing workspace dependencies..."
npm ci || npm install
npm install -w apps/web
npm install -w apps/web --save-dev @types/uuid || true
npm install -w services/signaling

echo "Creating env files if missing..."
[ -f apps/web/.env.local ] || cp apps/web/env.local.example apps/web/.env.local
[ -f .env ] || cp infra/env.local.example .env

# Ensure DeepL keys placeholders exist and print setup instructions
if ! grep -q '^DEEPL_API_KEY=' apps/web/.env.local 2>/dev/null; then
  cat >> apps/web/.env.local <<'EOF'

# DeepL translation (server-side)
DEEPL_API_KEY=
# If using free tier, uncomment:
# DEEPL_API_FREE=1
# Optional custom endpoint:
# DEEPL_API_URL=https://api-free.deepl.com/v2/translate
EOF
fi
if ! grep -q '^DEEPL_API_KEY=' .env 2>/dev/null; then
  cat >> .env <<'EOF'

# DeepL translation (used by Docker compose)
DEEPL_API_KEY=
# DEEPL_API_FREE=1
EOF
fi

echo
echo "IMPORTANT: Set your API keys before starting SupiChat:"
echo "  - Edit apps/web/.env.local and set:"
echo "      DEEPL_API_KEY=your-deepl-key"
echo "    Optional (free tier): DEEPL_API_FREE=1"
echo "  - If you deploy with Docker later, also edit .env similarly."
echo "  - Never prefix secrets with NEXT_PUBLIC_."
echo

# Interactive configuration
echo "--- SupiChat setup ---"
CUR_KEY=$(awk -F= '/^DEEPL_API_KEY=/{print $2}' apps/web/.env.local 2>/dev/null | head -1)
echo "Current DeepL key: $(mask "$CUR_KEY")"
ANS=$(prompt "Update DeepL key now?" "n")
if [ "${ANS,,}" = "y" ]; then
  NEW_KEY=$(prompt "Enter DEEPL_API_KEY" "")
  if [ -n "$NEW_KEY" ]; then
    set_kv apps/web/.env.local DEEPL_API_KEY "$NEW_KEY"
  fi
  FREE=$(prompt "Use DeepL free tier? (set DEEPL_API_FREE=1)" "n")
  if [ "${FREE,,}" = "y" ]; then
    set_kv apps/web/.env.local DEEPL_API_FREE "1"
  fi
fi

CUR_BP=$(awk -F= '/^NEXT_PUBLIC_BASE_PATH=/{print $2}' apps/web/.env.local 2>/dev/null | head -1)
[ -n "$CUR_BP" ] || CUR_BP="/supichat"
NEW_BP=$(prompt "Base path (NEXT_PUBLIC_BASE_PATH)" "$CUR_BP")
set_kv apps/web/.env.local NEXT_PUBLIC_BASE_PATH "$NEW_BP"

# Ports config
[ -n "${WEB_PORT:-}" ] || WEB_PORT=3000
[ -n "${SIGNALING_PORT:-}" ] || SIGNALING_PORT=4001
WEB_PORT=$(prompt "Internal web port (Next.js)" "$WEB_PORT")
SIGNALING_PORT=$(prompt "Internal signaling port" "$SIGNALING_PORT")

# Run as user config
DEF_RUN_AS="${RUN_AS_USER:-}"
if [ -z "$DEF_RUN_AS" ]; then
  if [ "$(id -u)" = "0" ]; then DEF_RUN_AS="supichat"; else DEF_RUN_AS="$(id -un)"; fi
fi
RUN_AS_USER=$(prompt "Run services as user" "$DEF_RUN_AS")
if [ "$(id -u)" = "0" ] && [ "$RUN_AS_USER" != "root" ]; then
  if ! id -u "$RUN_AS_USER" >/dev/null 2>&1; then
    echo "Creating user $RUN_AS_USER ..."; useradd -m -s /bin/bash "$RUN_AS_USER"
  fi
  chown -R "$RUN_AS_USER":"$RUN_AS_USER" .
  # Ensure pm2 is installed for that user environment
  sudo -u "$RUN_AS_USER" -H pm2 -v >/dev/null 2>&1 || sudo -u "$RUN_AS_USER" -H npm install -g pm2 || true
fi

# Save runtime config
cat > "$CONFIG_FILE" <<EOF
WEB_PORT=$WEB_PORT
SIGNALING_PORT=$SIGNALING_PORT
RUN_AS_USER=$RUN_AS_USER
BASE_PATH=$NEW_BP
EOF

echo "Building web app..."
npm run build -w apps/web

echo "Creating start/stop scripts..."
cat > start.sh <<'EOS'
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
if [ -x node_modules/.bin/next ]; then
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
EOS
chmod +x start.sh

cat > stop.sh <<'EOS'
#!/usr/bin/env bash
set -e
pm2 stop supichat-web || true
pm2 stop supichat-signaling || true
pm2 delete supichat-web || true
pm2 delete supichat-signaling || true
EOS
chmod +x stop.sh

cat > restart.sh <<'EOS'
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
if ! run_pm2 restart supichat-web; then
  if [ -x node_modules/.bin/next ]; then
    run_pm2 start node_modules/next/dist/bin/next --name supichat-web -- start -p "$WEB_PORT"
  else
    run_pm2 start npm --name supichat-web -- start
  fi
fi
popd >/dev/null

pushd services/signaling >/dev/null
if ! run_pm2 restart supichat-signaling; then
  PORT="$SIGNALING_PORT" run_pm2 start server.js --name supichat-signaling --update-env
fi
popd >/dev/null
run_pm2 save

HOST=${SUPICHAT_HOST:-$(curl -fsS ifconfig.me || curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}' || echo localhost)}

echo "\nSupiChat URL:  http://$HOST:${WEB_PORT}$BASE_PATH"
echo "Signaling:    http://$HOST:${SIGNALING_PORT}/health"

# Optional service check
[ -x ./check-services.sh ] && ./check-services.sh || true
EOS
chmod +x restart.sh

echo "Done. Use ./start.sh to launch, ./restart.sh after a git pull, and ./stop.sh to stop."

ANS=$(prompt "Run HTTPS setup now (nginx + certbot)?" "n")
if [ "${ANS,,}" = "y" ]; then
  HOST=$(prompt "Enter domain or IP for HTTPS" "")
  if [ -n "$HOST" ]; then
    echo "Running HTTPS setup for $HOST ..."
    sudo bash infra/setup-https.sh "$HOST"
  else
    echo "Skipped: no host provided."
  fi
fi


