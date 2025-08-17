# SupiChat Docker Quickstart

This project ships with Docker configs that work on Windows/macOS/Linux via Docker Desktop.

## Prerequisites
- Docker Desktop (WSL2 backend on Windows)

## Start (no TURN)
From repo root:

```bash
# copy env to repo root as .env (Compose reads ../.env in infra/docker-compose.yml)
copy infra\env.local.example .env   # Windows PowerShell
# or
cp infra/env.local.example .env     # macOS/Linux

# recommended: enable BuildKit/buildx for faster, cache-friendly builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# run compose (Compose v2)
docker compose -f infra/docker-compose.yml up --build

# if your Docker lacks the v2 "compose" subcommand, use the legacy binary:
# docker-compose -f infra/docker-compose.yml up --build
```

Tip: To install Compose v2 and buildx on Ubuntu (requires sudo):
```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin docker-buildx-plugin
docker compose version
docker buildx version
```

Open: http://localhost:3000/supichat

For quick verification without a browser, you can run from host:
```bash
curl -sSf http://localhost:3000/supichat >/dev/null && echo OK || echo FAIL
```

To restart services after pulling latest code:
```bash
docker compose -f infra/docker-compose.yml down
docker compose -f infra/docker-compose.yml up -d --build
```

Systemd alternative (on a VPS without Docker): create unit files to run `apps/web` (Next.js) and `services/signaling` (Node) as services, or use the provided script below.

Notes:
- For local dev, TURN is optional; STUN is sufficient within the same network.
- The `coturn` service is disabled by default using profiles.

## Enable TURN locally (experimental on Windows)
Turn on the `turn` profile and expose UDP ports:

```bash
docker compose -f infra/docker-compose.yml --profile turn up --build
```

Make sure `TURN_SECRET` is set in your `.env`.

For production, run TURN on a VPS or use a managed service (Twilio/Xirsys).
