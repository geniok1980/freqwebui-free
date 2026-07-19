FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Ensure src is importable
ENV PYTHONPATH=/app

# Run bot
CMD ["python", "-u", "-m", "src.main"]
