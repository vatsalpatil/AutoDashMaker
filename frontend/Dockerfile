# Dokploy service "frontend": Build Type = Dockerfile, Base Directory = /frontend, Dockerfile = Dockerfile
# Official images only (Docker Hub), no nixpkgs download. Each step is cached: unchanged package-lock = no reinstall.

# 1) build the Vite app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2) serve dist/ with Caddy and proxy /api to the backend (same config as before: caddy.conf)
FROM caddy:2-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY caddy.conf ./caddy.conf
ENV PORT=3000
EXPOSE 3000
CMD ["caddy", "run", "--config", "caddy.conf", "--adapter", "caddyfile"]
