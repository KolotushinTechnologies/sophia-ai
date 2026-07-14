# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
COPY packages/mcp-tools/package.json packages/mcp-tools/

RUN npm ci

COPY tsconfig.base.json tsconfig.build.json ./
COPY apps ./apps
COPY packages ./packages

RUN find . -name '*.tsbuildinfo' -delete \
  && npm run build \
  && test -f packages/shared/dist/index.js \
  && test -f apps/server/dist/index.js \
  && test -f apps/web/dist/index.html

# --- API ---
FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/domain/package.json packages/domain/
COPY packages/mcp-tools/package.json packages/mcp-tools/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/mcp-tools/dist packages/mcp-tools/dist
COPY --from=build /app/apps/server/dist apps/server/dist

EXPOSE 5555
CMD ["node", "apps/server/dist/index.js"]

# --- Web (SPA + /api proxy) ---
FROM nginx:1.27-alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '' \
  '  location /api/ {' \
  '    proxy_pass http://api:5555;' \
  '    proxy_http_version 1.1;' \
  '    proxy_set_header Host $host;' \
  '    proxy_set_header X-Real-IP $remote_addr;' \
  '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '    proxy_set_header X-Forwarded-Proto $scheme;' \
  '    proxy_set_header Connection "";' \
  '    proxy_buffering off;' \
  '    proxy_cache off;' \
  '    proxy_read_timeout 3600s;' \
  '    proxy_send_timeout 3600s;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf
EXPOSE 80
