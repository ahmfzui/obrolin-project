# API Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages directly
RUN pip install --no-cache-dir \
    langchain==0.3.27 \
    langchain-core==0.3.72 \
    langchain-openai==0.3.27 \
    langchain-text-splitters==0.3.9 \
    langdetect==1.0.9 \
    langgraph==0.6.2 \
    langgraph-checkpoint==2.1.1 \
    langgraph-checkpoint-postgres==2.0.23 \
    langgraph-prebuilt==0.6.2 \
    langgraph-sdk==0.2.0 \
    langsmith==0.4.4 \
    pydantic>=2.10.0 \
    python-dotenv==1.1.1 \
    psycopg[binary]==3.2.9 \
    openai==1.93.3 \
    tiktoken==0.9.0 \
    qdrant-client \
    fastapi \
    uvicorn \
    python-multipart \
    PyPDF2 \
    pdfplumber \
    python-docx \
    python-pptx \
    openpyxl \
    fastembed \
    numpy \
    httpx

# Copy all application code from api folder
COPY . .

# Railway provides PORT env var
ENV PORT=5000
ENV PYTHONUNBUFFERED=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:${PORT}/health', timeout=5.0)" || exit 1

CMD ["sh", "-c", "python db_setup.py && uvicorn fastapi-app:app --host 0.0.0.0 --port $PORT"]
