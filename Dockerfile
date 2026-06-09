FROM golang:1.24-alpine AS backend-build

WORKDIR /src/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM node:24-alpine AS frontend-build

WORKDIR /src/frontend

ENV NEXT_TELEMETRY_DISABLED=1

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:5002
ARG NEXT_PUBLIC_WS_URL=ws://localhost:5002/ws
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

WORKDIR /app

ENV APP_TIMEZONE=Asia/Kolkata
ENV DB_PATH=/app/data/hostel.db
ENV FRONTEND_PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=5002
ENV STORAGE_DIR=/app/data/storage

RUN apk add --no-cache ca-certificates tzdata

COPY --from=backend-build /out/api /usr/local/bin/api
COPY --from=frontend-build /src/frontend/.next ./frontend/.next
COPY --from=frontend-build /src/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-build /src/frontend/package.json ./frontend/package.json
COPY --from=frontend-build /src/frontend/public ./frontend/public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/data"]
EXPOSE 3000 5002

CMD ["docker-entrypoint.sh"]
