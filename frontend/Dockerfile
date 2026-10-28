# ---- deps + build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Production uses App Router /api/[...path] at runtime (not build-time rewrites).
# Compose still passes API_PROXY_TARGET at runtime to reach the backend service.
ARG API_PROXY_TARGET=http://localhost:8080
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN npm run typecheck && npm run build

# ---- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/next.config.ts ./next.config.ts
# Runtime proxy target (Compose: http://backend:8080). Override per environment.
ARG API_PROXY_TARGET=http://localhost:8080
ENV API_PROXY_TARGET=$API_PROXY_TARGET
EXPOSE 3000
CMD ["npm", "run", "start"]
