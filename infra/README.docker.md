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

# run compose
docker compose -f infra/docker-compose.yml up --build
```

Open: http://localhost:3000/MyChatApp

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
