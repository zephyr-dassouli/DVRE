# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# This includes streamflow==0.1.6 for orchestration
RUN pip install --no-cache-dir -r requirements.txt

# Install additional system dependencies for StreamFlow orchestration
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy setup files first
COPY setup.py .
COPY MANIFEST.in .

# Copy the modular source code
COPY src/ ./src/

# Copy StreamFlow orchestration configuration
COPY streamflow.yml ./

# Copy Jupyter configuration
COPY jupyter_config.py /root/.jupyter/

# Copy remaining files
COPY . .

# Install the server extension (this will now properly include all modular files)
RUN pip install -e .

# Make port 8888 available to the world outside this container
EXPOSE 8888

# Define environment variables for orchestration
ENV JUPYTER_TOKEN=dvre-orchestrator-token
ENV DVRE_ROLE=orchestration
ENV EXECUTION_MODEL=server_orchestrates_client_executes

# Run the command to start the jupyter server when the container launches
# Use the configuration file for proper CORS setup
CMD ["jupyter", "server", "--config=/root/.jupyter/jupyter_config.py"] 