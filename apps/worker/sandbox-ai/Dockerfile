# Phase 06 — SKIDS Sandbox AI (second-opinion inference container).
#
# Stays Alpine-slim so the image clears the 400MB budget the spec calls
# for. Everything here runs under Cloudflare Containers (open beta) as a
# Durable Object–fronted binding — see apps/worker/wrangler.toml once the
# [[containers]] block is uncommented.
#
# Build locally:
#   cd apps/worker/sandbox-ai
#   docker build -t skids-sandbox-ai:dev .
#
# Deploy (via wrangler, once the image registry is connected):
#   pnpm exec wrangler containers build ./sandbox-ai -t skids-sandbox-ai:$(git rev-parse --short HEAD)
#   pnpm exec wrangler containers push skids-sandbox-ai:...

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ORT_LOGGING_LEVEL=2

# Runtime deps for opencv-headless; no GUI libs — we only decode/encode.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libjpeg62-turbo \
        libpng16-16 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source.
COPY analyze.py models_registry.py ./

# Models are injected at runtime from R2 (skids-models bucket) — NOT baked.
ENV MODELS_DIR=/tmp/models

# Cloudflare Containers expects port 8080 by default for ingress. We run a
# tiny HTTP listener that accepts POST /analyze with a JSON body and
# streams the result back.
EXPOSE 8080

CMD ["python", "analyze.py", "--listen", "0.0.0.0:8080"]
