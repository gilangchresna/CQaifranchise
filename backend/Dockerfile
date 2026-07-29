# ─────────────────────────────────────────────────────────────
# CyberQuote Backend Dockerfile
# Python 3.11 + FastAPI + Uvicorn
# Multi-stage build for minimal image size
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt


# ── Stage 2: Production ──────────────────────────────────────
FROM python:3.11-slim as production

# Security: create non-root user
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy application code
COPY backend/ ./backend/
COPY Makefile ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PY_ENV=production \
    PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE ${PORT}

# Default command - uvicorn with gunicorn workers for production
# Using uvicorn directly for simplicity; switch to gunicorn for high-traffic
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]


# ── Stage 3: Development (optional) ──────────────────────────
FROM production as development

USER root

# Install additional dev dependencies
COPY backend/requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

# Install Modal SDK for ML inference
RUN pip install --no-cache-dir modal

USER appuser

# Override command for dev - reload enabled
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
