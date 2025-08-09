# SupiChat

Minimal Google-Meet-like web app with WebRTC mesh and auto-translating chat.

## Features
- Start room → share link `/MyChatApp/room/<uuid>`
- Join/leave, camera/mic toggle
- Chat with per-user language; incoming messages auto-translate (OpenAI mini)

## Quick start (local)
```bash
# at repo root
cp .env.example .env
# fill OPENAI_API_KEY, TURN_SECRET, optionally ICE envs
npm i
npm run dev -w apps/web
# in a second terminal
npm --workspace services/signaling install
node services/signaling/server.js
# open http://localhost:3000/MyChatApp
```

## Docker on a vServer
```bash
# install docker, docker-compose, nginx (as root)
sudo apt update && sudo apt install -y docker.io docker-compose nginx

# clone repo and set envs
cp .env.example .env
# set: OPENAI_API_KEY, TURN_SECRET, NEXT_PUBLIC_* values

# run services
cd infra
sudo docker-compose up -d --build

# nginx
sudo cp nginx.conf /etc/nginx/sites-available/supichat
sudo ln -s /etc/nginx/sites-available/supichat /etc/nginx/sites-enabled/supichat
sudo nginx -t && sudo systemctl reload nginx

# access
http://YOUR_SERVER_IP/MyChatApp
```

## Notes
- Mesh is fine for ~4–6 participants. For larger rooms, move to an SFU (e.g., LiveKit) later.
- TURN credentials: for production, generate time-limited creds server-side; this MVP uses static creds via env for simplicity.
- Socket.IO runs as a separate service for reliability; NGINX proxies `/MyChatApp/socket.io`.
- If you serve over HTTPS, enable TLS in NGINX and use `wss://` automatically via proxy.

## TODO (future)
- Auto-detect source language; translate only when different from user setting.
- Live captions via a realtime ASR + translation.
- Lobby + simple auth.
- Recording (requires SFU or media server).

## Health checks
- Web: `GET /MyChatApp/api/health` → `{ status: "ok", service: "web", ... }`
- Signaling: `GET /health` → `{ status: "ok", service: "signaling", ... }`

### Quick manual checks
```bash
# local dev
curl http://localhost:3000/MyChatApp/api/health
curl http://localhost:4001/health

# server behind nginx (HTTP)
curl http://YOUR_SERVER_IP/MyChatApp/api/health
curl http://YOUR_SERVER_IP/MyChatApp/socket.io/?EIO=4&transport=polling  # basic socket.io reachability
```

## Testing (Vitest minimal)
```bash
npm i -D -w apps/web vitest
npm run test -w apps/web
```

## Operational notes
- If WebSocket fails through your reverse proxy, re-check NGINX `Upgrade` and `Connection` headers and path (`/MyChatApp/socket.io/`).
- For TURN, prefer time-limited credentials in production. This MVP uses static creds. Lets make sure my private creds arent visible in Github publicly.

