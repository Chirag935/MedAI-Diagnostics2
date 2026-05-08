FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python deps first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY . .

# Hugging Face Spaces requires the app to listen on 7860
ENV PORT=7860
EXPOSE 7860

# Download models from HF on container start, then launch gunicorn
CMD python download_models.py && \
    gunicorn main:app \
        --workers 1 \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:$PORT \
        --timeout 120
