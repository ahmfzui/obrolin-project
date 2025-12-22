# API Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for easyocr, pillow, pymupdf
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages directly
RUN pip install --no-cache-dir \
    streamlit==1.46.1 \
    langchain==0.3.27 \
    langchain-anthropic==0.3.18 \
    langchain-chroma==0.2.5 \
    langchain-community==0.3.27 \
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
    psycopg==3.2.9 \
    chromadb==1.0.20 \
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
    pymupdf \
    easyocr \
    fastembed \
    pillow \
    numpy \
    chainlit==1.3.1 \
    httpx

# Copy application code
COPY . .

# Railway provides PORT env var
ENV PORT=5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD python -c "import requests; requests.get('http://localhost:${PORT}/health')"

CMD python db_setup.py && uvicorn fastapi-app:app --host 0.0.0.0 --port $PORT
