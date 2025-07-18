FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY workflows/ ./workflows/

# Create necessary directories
RUN mkdir -p /dal_data

# Expose port for API
EXPOSE 8001

# Set environment variables
ENV PYTHONPATH=/app
ENV DAL_DATA_PATH=/dal_data
ENV DVRE_API_URL=http://dvre-server:8000
ENV BLOCKCHAIN_RPC_URL=http://localhost:8545

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application
CMD ["python", "-m", "src.main"] 