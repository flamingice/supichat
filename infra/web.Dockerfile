# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
COPY apps ./apps
RUN cd apps/web && npm ci && npm run build && cp -r .next/standalone /standalone && cp -r public /standalone/public && cp -r .next/static /standalone/.next/static

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /standalone ./
EXPOSE 3000
CMD ["node", "server.js"]


