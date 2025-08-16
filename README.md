# SupiChat

A real-time video chat application with automatic message translation.

## Features

- Real-time video chat using WebRTC
- Automatic message translation between multiple languages
- Simple room-based chat system
- Modern React/Next.js frontend
- Socket.IO signaling server

## Quick Start for Windows

### Prerequisites

1. **Node.js** (v18 or higher) - Will be automatically installed if not present
2. **npm** (comes with Node.js)

### Auto-Installation Feature

SupiChat includes automatic Node.js installation! If Node.js is not detected on your system, the startup scripts will:

- Download Node.js v20.11.1 from the official website
- Install it silently in the background
- Configure environment variables
- Continue with SupiChat setup

**Note**: For best results, run the scripts as Administrator. If you prefer manual installation, you can:
- Run `npm run install:nodejs` to install Node.js only
- Or download manually from [nodejs.org](https://nodejs.org/)

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

- `npm run dev:windows` - Start both services (Windows batch)
- `npm run dev:windows:ps` - Start both services (Windows PowerShell)
- `npm run dev:web` - Start web app only
- `npm run dev:signaling` - Start signaling server only
- `npm run install:all` - Install all dependencies
- `npm run build` - Build for production
- `npm run start` - Start production build
- `npm run smoke` - Run a local smoke test (curl-based)

### Windows Scripts

- `start-windows.bat` - Start both services (batch file)
- `start-windows.ps1` - Start both services (PowerShell script)
- `stop-windows.bat` - Stop running services
- `install-nodejs.ps1` - Standalone Node.js installer

### Available Scripts

- `npm run dev:windows` - Start both services (Windows batch)
- `npm run dev:windows:ps` - Start both services (Windows PowerShell)
- `npm run dev:web` - Start web app only
- `npm run dev:signaling` - Start signaling server only
- `npm run install:all` - Install all dependencies
- `npm run install:nodejs` - Install Node.js only
- `npm run build` - Build for production
- `npm run start` - Start production build

### Troubleshooting

**Node.js installation issues:**
- Run scripts as Administrator for best results
- Check internet connection for download
- If auto-installation fails, run `npm run install:nodejs` manually
- Restart computer after installation if Node.js is not found

**Port already in use:**
- Web app (3000): Change port in `apps/web/package.json`
- Signaling (4001): Change port in `services/signaling/server.js`

**WebRTC issues:**
- Ensure you're using HTTPS in production
- Check firewall settings
- Verify STUN/TURN server configuration

**Translation not working:**
- Check translation API configuration in `.env.local`
- Verify API keys are valid

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
- TURN (`coturn`) is optional for local dev and disabled by default via profiles.
- To enable TURN (may be limited on Windows due to UDP/NAT), run:
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
- ✅ Installs Docker if missing
- ✅ Builds and starts SupiChat  
- ✅ Creates management scripts
- ✅ Handles camera/microphone access guidance

## 📹 Camera/Microphone Access

**For Testing:**
- ✅ **localhost** - Always works (even HTTP): `http://localhost:3000/supichat`
- ✅ **127.0.0.1** - Always works: `http://127.0.0.1:3000/supichat`

**For Production (Public IP):**
- 🔒 **HTTPS required** - Run `./ssl-setup.sh` after installation
- 🏷️ **Domain recommended** - Point domain to your server IP

**For Testing Public IP without HTTPS:**
- 🛠️ **Chrome flags**: `--unsafely-treat-insecure-origin-as-secure=http://YOUR_IP:3000`

---

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

---

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

---

### Configuration Notes
- Set `DEEPL_API_KEY` for translations
- Configure nginx reverse proxy (see `infra/nginx.conf`)
- Consider TURN server for better NAT traversal

HTTPS (domain or IP)
- Run interactive HTTPS setup: `sudo bash infra/setup-https.sh your.domain` or your server IP.
- For IP certificates, Let’s Encrypt has announced short‑lived IP certs (~6 days). Not all ACME clients (e.g. certbot) may fully support them yet. The script will attempt issuance; if unsupported, it offers a self‑signed fallback and leaves a renewal timer only when an LE IP cert is present. See: [Let’s Encrypt – We’ve Issued Our First IP Address Certificate](https://letsencrypt.org/2025/07/01/issuing-our-first-ip-address-certificate).

## License

[Your License Here]



