#!/usr/bin/env bash
set -euo pipefail

# SupiChat Ubuntu install script (rootless)
# - Installs Node.js and PM2 for process management
# - Sets up env files and start/stop scripts

if ! command -v curl >/dev/null 2>&1; then
  echo "Installing curl...";
  sudo apt-get update -y && sudo apt-get install -y curl ca-certificates
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js LTS...";
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential
fi

echo "Installing pnpm (optional) and pm2..."
npm install -g pm2 >/dev/null 2>&1 || sudo npm install -g pm2

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

echo "Building web app..."
npm run build -w apps/web

echo "Creating start/stop scripts..."
cat > start.sh <<'EOS'
#!/usr/bin/env bash
set -e
pm2 start services/signaling/server.js --name supichat-signaling --cwd $(pwd)/services/signaling --update-env
pm2 start npm --name supichat-web --time -- start --cwd $(pwd)/apps/web
pm2 save
pm2 status
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
pm2 restart supichat-web || pm2 start npm --name supichat-web -- start --cwd $(pwd)/apps/web
pm2 restart supichat-signaling || pm2 start services/signaling/server.js --name supichat-signaling --cwd $(pwd)/services/signaling --update-env
pm2 save
EOS
chmod +x restart.sh

echo "Done. Use ./start.sh to launch, ./restart.sh after a git pull, and ./stop.sh to stop."


