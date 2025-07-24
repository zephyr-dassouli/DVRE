# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# We also install jupyter_server which is the core for the backend.
RUN pip install --no-cache-dir -r requirements.txt jupyter_server

# Copy the rest of the application's code to the working directory
COPY . .

# Copy Jupyter configuration
COPY jupyter_config.py /root/.jupyter/

# Install the server extension
RUN pip install .

# Make port 8888 available to the world outside this container
EXPOSE 8888

# Define environment variable
ENV JUPYTER_TOKEN=dvre-orchestrator-token

# Run the command to start the jupyter server when the container launches
# Use the configuration file for proper CORS setup
CMD ["jupyter", "server", "--config=/root/.jupyter/jupyter_config.py"] 