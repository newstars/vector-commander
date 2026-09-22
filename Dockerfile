# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
ARG NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="Vector Commander" \
      org.opencontainers.image.description="Seoul GIS mosquito control strategy simulation" \
      org.opencontainers.image.ref.name="vector-commander"

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/backend/.venv/bin:$PATH"
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python3 -m venv /app/backend/.venv \
  && /app/backend/.venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/app /app/backend/app
COPY backend/data /app/backend/data
COPY shared /app/shared
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public
COPY scripts/start-container.sh /app/start-container.sh

EXPOSE 3000 8000
CMD ["/app/start-container.sh"]
