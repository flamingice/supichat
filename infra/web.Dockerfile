# Build stage (workspaces-aware)
FROM node:20-alpine AS builder
WORKDIR /repo

# Copy root manifests and workspaces
COPY package.json package-lock.json* .npmrc* ./
COPY apps/web/package.json ./apps/web/package.json

# Install deps only for web workspace (avoids needing other workspaces during build)
RUN npm ci -w apps/web

# Copy source after dependencies (better layer caching)
COPY apps ./apps

# Build the web app (Next.js standalone output)
RUN npm run build -w apps/web \
  && cp -r apps/web/.next/standalone /standalone \
  && cp -r apps/web/public /standalone/public \
  && cp -r apps/web/.next/static /standalone/.next/static

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /standalone ./
EXPOSE 3000
CMD ["node", "server.js"]




