#!/bin/bash

# DVRE Orchestration Server - Automated Deployment Script
# This script automates the Jupyter-based orchestration server deployment for Ubuntu/Debian systems

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Configuration
SERVICE_NAME="dvre-orchestration"
APP_DIR="/home/$USER/orchestration-server"
PORT=5004

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--port PORT]"
            echo "  --port      Port to run the service on (default: 5004)"
            echo ""
            echo "This script deploys the Jupyter-based DVRE Orchestration Server using Docker."
            exit 0
            ;;
        *)
            print_error "Unknown option $1"
            exit 1
            ;;
    esac
done

print_header "DVRE Orchestration Server Deployment (Jupyter-based)"
print_info "Port: $PORT"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Check OS
if ! command -v apt-get >/dev/null 2>&1; then
    print_error "This script is designed for Ubuntu/Debian systems"
    exit 1
fi

# Comprehensive cleanup function
cleanup_existing_deployments() {
    print_header "Cleaning Up Existing Deployments"
    
    # Kill processes using the target port
    print_info "Freeing up port $PORT..."
    sudo fuser -k ${PORT}/tcp 2>/dev/null || true
    
    # Stop Docker containers by image
    print_info "Stopping containers using orchestration-server image..."
    docker ps -q --filter ancestor=orchestration-server:latest | xargs -r docker stop 2>/dev/null || true
    docker ps -aq --filter ancestor=orchestration-server:latest | xargs -r docker rm 2>/dev/null || true
    
    # Stop containers by name pattern
    print_info "Stopping containers with orchestration in name..."
    docker ps --filter "name=orchestration" -q | xargs -r docker stop 2>/dev/null || true
    docker ps --filter "name=orchestration" -aq | xargs -r docker rm 2>/dev/null || true
    
    # Stop specific named containers (legacy support)
    docker stop dvre-orchestration orchestration-server 2>/dev/null || true
    docker rm dvre-orchestration orchestration-server 2>/dev/null || true
    
    # Stop systemd service if exists (legacy cleanup)
    print_info "Stopping any legacy systemd services..."
    sudo systemctl stop $SERVICE_NAME 2>/dev/null || true
    
    # Clean up old Docker images (optional - saves space)
    print_info "Cleaning up old Docker images..."
    docker image prune -f 2>/dev/null || true
    
    # Wait a moment for processes to fully terminate
    sleep 2
    
    # Verify port is free
    if ss -tulpn | grep -q ":${PORT} "; then
        print_warning "Port $PORT still in use, attempting force cleanup..."
        sudo fuser -k ${PORT}/tcp 2>/dev/null || true
        sleep 2
    fi
    
    print_success "Cleanup completed"
}

# Update system
print_header "Updating System"
sudo apt update
print_success "System updated"

# Install Docker dependencies
print_header "Installing Docker Dependencies"
sudo apt install -y curl wget git docker.io
print_success "Dependencies installed"

# Run cleanup before deployment
cleanup_existing_deployments

# Docker deployment
print_header "Jupyter Server Docker Deployment"

# Install Docker if not present
if ! command -v docker >/dev/null 2>&1; then
    print_info "Installing Docker..."
    sudo apt install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    print_success "Docker installed"
    print_warning "Please log out and back in for Docker group changes to take effect"
else
    print_success "Docker already installed"
fi

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found. Please run this script from the orchestration-server directory"
    exit 1
fi

if [ ! -d "src" ]; then
    print_error "src directory not found. Please ensure the Jupyter server extension is present"
    exit 1
fi

# Build Docker image
print_info "Building Jupyter orchestration server Docker image..."
docker build -t orchestration-server:latest .
print_success "Docker image built"

# Run container with consistent naming
print_info "Starting Jupyter orchestration server container..."
docker run -d \
    --name orchestration-server \
    -p $PORT:8888 \
    -v $(pwd)/workflows:/app/workflows \
    --restart unless-stopped \
    orchestration-server:latest

print_success "Jupyter orchestration server container started"

# Configure firewall
print_header "Configuring Firewall"
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow $PORT/tcp 2>/dev/null || true
    print_success "Firewall configured (ufw)"
elif command -v firewall-cmd >/dev/null 2>&1; then
    sudo firewall-cmd --permanent --add-port=$PORT/tcp 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    print_success "Firewall configured (firewalld)"
else
    print_warning "No firewall detected. You may need to manually open port $PORT"
fi

# Test extension loading
print_header "Testing Extension Loading"
print_info "Running extension diagnostics..."
if docker exec orchestration-server python3 debug_extension.py; then
    print_success "Extension diagnostics passed"
else
    print_warning "Extension diagnostics failed - checking logs..."
    docker logs orchestration-server --tail 30
fi

# Test endpoints with better error handling
print_header "Testing API Endpoints"
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' orchestration-server)
print_info "Container IP: $CONTAINER_IP"

# Wait for startup
print_info "Waiting for Jupyter server to fully start..."
sleep 10

# Test Jupyter server first
print_info "Testing Jupyter server root..."
ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
echo "Root endpoint status: $ROOT_STATUS"

# Test tree endpoint
print_info "Testing Jupyter tree endpoint..."
TREE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/tree 2>/dev/null || echo "000")
echo "Tree endpoint status: $TREE_STATUS"

# Test streamflow endpoints with detailed error reporting
print_info "Testing Streamflow API endpoints..."
WORKFLOWS_STATUS=$(curl -s -w "%{http_code}" http://localhost:$PORT/streamflow/workflows 2>/dev/null | tail -1)
echo "Workflows endpoint status: $WORKFLOWS_STATUS"

if [ "$WORKFLOWS_STATUS" != "200" ]; then
    print_warning "Streamflow endpoint returning error. Checking detailed response..."
    curl -v http://localhost:$PORT/streamflow/workflows 2>&1 | head -20
    
    print_info "Checking container logs for errors..."
    docker logs orchestration-server --tail 50 | grep -A5 -B5 -i error || echo "No obvious errors in logs"
fi

# Test AL-engine endpoints
AL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/al-engine/sessions 2>/dev/null || echo "000")
echo "AL-engine sessions status: $AL_STATUS"

# Show service status
print_header "Deployment Status"
echo "Jupyter orchestration server status:"
docker ps | grep orchestration-server || print_error "Container not running"

if docker ps | grep -q orchestration-server; then
    print_success "Container is running"
    
    # Show recent logs
    print_info "Recent container logs:"
    docker logs orchestration-server --tail 20
    
    # Test a simple workflow submission
    print_info "Testing workflow submission..."
    SUBMIT_TEST=$(curl -s -X POST -H 'Content-Type: application/json' \
        -d '{"cwl_workflow": "{\"cwlVersion\": \"v1.0\", \"class\": \"CommandLineTool\", \"baseCommand\": \"echo\"}", "inputs": {"message": "test"}}' \
        -w "%{http_code}" \
        http://localhost:$PORT/streamflow/submit 2>/dev/null | tail -1)
    
    if [ "$SUBMIT_TEST" = "200" ]; then
        print_success "Workflow submission test passed"
    else
        print_warning "Workflow submission test failed (HTTP $SUBMIT_TEST)"
    fi
else
    print_error "Container not running properly"
    docker logs orchestration-server
fi

echo ""
echo "Available management commands:"
echo "View logs: docker logs -f orchestration-server"
echo "Debug extension: docker exec -it orchestration-server python3 debug_extension.py"
echo "Shell access: docker exec -it orchestration-server bash"
echo "Stop service: docker stop orchestration-server"
echo "Start service: docker start orchestration-server"
echo "Restart: docker restart orchestration-server"

print_header "Deployment Complete"
if [ "$WORKFLOWS_STATUS" = "200" ] && [ "$AL_STATUS" = "200" ]; then
    print_success "DVRE Jupyter Orchestration Server is running successfully!"
    print_info "All API endpoints are responding correctly"
else
    print_warning "DVRE Jupyter Orchestration Server deployed but some endpoints may have issues"
    print_info "Check the logs and run diagnostics: docker exec orchestration-server python3 debug_extension.py"
fi

print_info "Jupyter Server URL: http://localhost:$PORT/"
print_info "External URL: http://$(hostname -I | awk '{print $1}'):$PORT/"
echo ""
print_info "API Documentation:"
echo "• Streamflow API: http://localhost:$PORT/streamflow/workflows"
echo "• AL-engine API: http://localhost:$PORT/al-engine/sessions"
echo ""
print_info "Test commands:"
echo "curl http://localhost:$PORT/streamflow/workflows"
echo "curl http://localhost:$PORT/al-engine/sessions"
echo ""
print_info "Submit test workflow:"
echo "curl -X POST -H 'Content-Type: application/json' \\"
echo "  -d '{\"cwl_workflow\":\"{\\\"cwlVersion\\\":\\\"v1.0\\\",\\\"class\\\":\\\"CommandLineTool\\\",\\\"baseCommand\\\":\\\"echo\\\"}\",\"inputs\":{\"message\":\"test\"}}' \\"
echo "  http://localhost:$PORT/streamflow/submit"
echo ""

# Create enhanced health check script
print_info "Creating enhanced health check script..."
tee health_check.sh > /dev/null <<EOF
#!/bin/bash
PORT=${PORT:-5004}

echo "=== DVRE Orchestration Server Health Check ==="
echo "Checking port: \$PORT"

# Test container status
if ! docker ps | grep -q orchestration-server; then
    echo "❌ Container not running"
    exit 1
fi

# Test endpoints
TREE_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:\$PORT/tree 2>/dev/null || echo "000")
WORKFLOWS_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:\$PORT/streamflow/workflows 2>/dev/null || echo "000")
AL_STATUS=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:\$PORT/al-engine/sessions 2>/dev/null || echo "000")

echo "Jupyter tree endpoint: \$TREE_STATUS"
echo "Streamflow API: \$WORKFLOWS_STATUS"
echo "AL-engine API: \$AL_STATUS"

if [ "\$WORKFLOWS_STATUS" = "200" ] && [ "\$AL_STATUS" = "200" ]; then
    echo "✅ All services healthy"
    exit 0
elif [ "\$TREE_STATUS" = "200" ]; then
    echo "⚠️  Jupyter running but extension may have issues"
    echo "Run: docker exec orchestration-server python3 debug_extension.py"
    exit 1
else
    echo "❌ Services unhealthy"
    echo "Check logs: docker logs orchestration-server"
    exit 1
fi
EOF
chmod +x health_check.sh
print_success "Enhanced health check script created: ./health_check.sh"

# Create quick debug script
print_info "Creating debug script..."
tee debug.sh > /dev/null <<EOF
#!/bin/bash
echo "=== DVRE Orchestration Server Debug ==="
echo "Container status:"
docker ps | grep orchestration-server

echo -e "\nRecent logs:"
docker logs orchestration-server --tail 30

echo -e "\nExtension diagnostics:"
docker exec orchestration-server python3 debug_extension.py

echo -e "\nEndpoint tests:"
curl -s -w "Streamflow workflows: %{http_code}\n" -o /dev/null http://localhost:${PORT}/streamflow/workflows
curl -s -w "AL-engine sessions: %{http_code}\n" -o /dev/null http://localhost:${PORT}/al-engine/sessions
EOF
chmod +x debug.sh
print_success "Debug script created: ./debug.sh"

# Create CORS testing script
print_info "Creating CORS testing script..."
chmod +x test_cors.sh
print_success "CORS testing script ready: ./test_cors.sh"

print_header "Next Steps"
echo "1. Test the deployment: ./health_check.sh"
echo "2. Debug any issues: ./debug.sh"  
echo "3. Run the test suite: ./test_orchestration_server.sh"
echo "4. Access Jupyter interface: http://YOUR_VM_IP:$PORT/tree"
echo "5. Configure your DAL frontend to connect to: http://YOUR_VM_IP:$PORT"
echo ""
if [ "$WORKFLOWS_STATUS" = "200" ] && [ "$AL_STATUS" = "200" ]; then
    print_success "✅ Deployment completed successfully - all systems operational!"
else
    print_warning "⚠️  Deployment completed but requires attention - run ./debug.sh for details"
fi 