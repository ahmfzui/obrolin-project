# API Dockerfile
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (for OCR/vision libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libglib2.0-0 \
        libgl1 \
        curl \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt ./
# Install CPU-only torch first to avoid downloading huge GPU wheels
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose API port
EXPOSE 5000

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -f http://localhost:5000/health/ || exit 1

# Start: ensure DB tables exist, then run FastAPI
CMD ["bash", "-lc", "python db_setup.py && uvicorn fastapi-app:app --host 0.0.0.0 --port 5000"]
