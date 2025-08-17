# SupiChat

A real-time video chat application with automatic message translation.

## Features


## Quick Start for Windows

### Prerequisites

1. **Node.js** (v18 or higher) - Will be automatically installed if not present
2. **npm** (comes with Node.js)

### Auto-Installation Feature

SupiChat includes automatic Node.js installation! If Node.js is not detected on your system, the startup scripts will:


**Note**: For best results, run the scripts as Administrator. If you prefer manual installation, you can:

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd supichat
   ```

2. **Run the Windows startup script:**
   ```bash
   # Option 1: Use the batch file (recommended)
   start-windows.bat
   
   # Option 2: Use PowerShell script (better error handling)
   start-windows.ps1
   
   # Option 3: Use npm script
   npm run dev:windows
   
   # Option 4: Use npm script with PowerShell
   npm run dev:windows:ps
   ```

3. **Or run manually:**
   ```bash
   # Install all dependencies
   npm run install:all
   
   # Copy environment file
   copy apps\web\env.local.example apps\web\.env.local
   
   # Start web app (in one terminal)
   npm run dev:web
   
   # Start signaling server (in another terminal)
   npm run dev:signaling
   ```

4. **Open your browser:**
   - Web app: http://localhost:3000
   - Signaling server: http://localhost:4001

## Manual Setup

### Environment Configuration

1. Copy the example environment file:
   ```bash
   copy apps\web\env.local.example apps\web\.env.local
   ```

2. Edit `apps/web/.env.local` if needed:
   ```env
   # Signaling server configuration
   NEXT_PUBLIC_SIGNALING_ORIGIN=http://localhost:4001
   NEXT_PUBLIC_SIGNALING_PATH=/supichat/socket.io
   NEXT_PUBLIC_BASE_PATH=/supichat
   
   # Default language
   NEXT_PUBLIC_DEFAULT_LANG=en
   
   # STUN server for WebRTC
   NEXT_PUBLIC_STUN_1=stun:stun.l.google.com:19302
   ```

### Running Individual Services

**Web App (Next.js):**
```bash
cd apps/web
npm install
npm run dev
```

**Signaling Server:**
```bash
cd services/signaling
npm install
npm start
```

## Project Structure

```
supichat/
├── apps/
│   └── web/                 # Next.js frontend
│       ├── src/
│       │   ├── app/         # App router pages
│       │   └── lib/         # Utilities
│       └── package.json
├── services/
│   └── signaling/           # Socket.IO signaling server
│       ├── server.js
│       └── package.json
├── infra/                   # Docker configuration
├── start-windows.bat        # Windows startup script
└── package.json
```

## Development

### Available Scripts


### Windows Scripts


### Available Scripts


### Troubleshooting

**Node.js installation issues:**

**Port already in use:**

**WebRTC issues:**

**Translation not working:**

## Docker (Windows/macOS/Linux)

Quickest way to run everything with minimal setup using Docker Desktop:

1. Ensure Docker Desktop is installed and running
2. From repo root, create `.env` (Compose reads it via `infra/docker-compose.yml`):
   ```bash
   # Windows PowerShell
   copy infra\env.local.example .env
   # macOS/Linux
   # cp infra/env.local.example .env
   ```
   Then edit `.env` to add your `DEEPL_API_KEY` (used for chat translation).
3. Start services:
   ```bash
   docker compose -f infra/docker-compose.yml up --build
   ```
4. Open: http://localhost:3000/supichat
5. Health checks (optional):
   ```bash
   curl http://localhost:3000/supichat/api/health
   curl http://localhost:4001/health
   ```

Notes:
  ```bash
  docker compose -f infra/docker-compose.yml --profile turn up --build
  ```
  Ensure `TURN_SECRET` is set in `.env`.

## 🚀 Quick Start (Production)

**One command deployment with Docker:**

```bash
# Fresh Ubuntu/Debian server? Run this:
git clone https://github.com/yourusername/supichat.git
cd supichat
bash infra/install-docker.sh
```

**That's it!** The script automatically:

## 📹 Camera/Microphone Access

**For Testing:**

**For Production (Public IP):**

**For Testing Public IP without HTTPS:**


## 🛠️ Development

**Local development with hot reload:**

```bash
# Clone and start
git clone https://github.com/yourusername/supichat.git
cd supichat
npm install
npm run dev

# Access at http://localhost:3000/supichat
# Camera/mic work perfectly on localhost!
```


## 🔧 Alternative Deployments

### systemd (Traditional) ⚙️

**For traditional bare-metal server deployments:**

```bash
# Install Node.js 18+ first
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Deploy SupiChat
git clone https://github.com/yourusername/supichat.git
cd supichat
bash infra/install-systemd.sh
```

**Benefits:** Native systemd integration, traditional service management, system-level logging.

### PM2 (Legacy) 📦

**Deprecated but still available:**

```bash
bash infra/install-ubuntu.sh  # Legacy PM2-based installer
```


### Configuration Notes

HTTPS (domain or IP)

## License

[Your License Here]



## Ideas / Roadmap

   - Feed the last 10–20 chat lines as context into the translation request so tone/names/pronouns remain consistent.
   - Implement in `apps/web/src/app/api/translate/route.ts`: accept optional `context` payload (array of recent messages) and pass to provider if supported.
   - Maintain a per-room sliding window on the client; trim to a safe token/char budget. Redact PII before sending.
   - Add rate limiting and caching to avoid provider overuse; include a feature flag to toggle context mode.

   - Small info icon beside translated text opens a popover with: alternative translations (when the provider supports variants), glossary hits, formality level, and a link to “Improve translation”.
   - UI: accessible icon button with tooltip; popover component that lazy-loads details via a lightweight API (`/api/translate/explain`).
   - Backend: call provider-specific endpoints/params to request alternatives or metadata; gracefully degrade if unavailable.
   - Guardrails: rate limit, cache per original text + lang pair, and avoid storing raw message content server-side.



