# DVRE Orchestration Server - VM Deployment Guide

This guide explains how to deploy the DVRE Orchestration Server on a virtual machine (VM) for production use.

## 🚀 Quick Deployment Options

### Option 1: Docker Deployment (Recommended)
- **Pros**: Isolated, consistent environment, easy to manage
- **Cons**: Requires Docker installation
- **Best for**: Production deployments

### Option 2: Manual Deployment
- **Pros**: Direct control, easier debugging
- **Cons**: More setup steps, dependency management
- **Best for**: Development, testing

---

## 🐳 Option 1: Docker Deployment

### Prerequisites
- VM with Ubuntu 20.04+ or CentOS 7+
- Docker installed
- Port 5002 available
- SSH access to the VM

### Step 1: Install Docker (if not already installed)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### Step 2: Transfer Files to VM

```bash
# From your local machine, copy the orchestration-server directory
scp -r orchestration-server/ user@your-vm-ip:/home/user/

# Or use git if your code is in a repository
ssh user@your-vm-ip
git clone https://github.com/your-repo/DVRE.git
cd DVRE/orchestration-server
```

### Step 3: Build and Run Docker Container

```bash
# On the VM
cd orchestration-server

# Build the Docker image
docker build -t dvre-orchestration-server .

# Run the container
docker run -d \
  --name dvre-orchestration \
  -p 5002:5002 \
  -v $(pwd)/workflows:/app/workflows \
  --restart unless-stopped \
  dvre-orchestration-server

# Check if it's running
docker ps
docker logs dvre-orchestration
```

### Step 4: Test the Deployment

```bash
# Test from the VM
curl http://localhost:5002/

# Test from external machine (replace VM_IP with actual IP)
curl http://VM_IP:5002/
```

### Step 5: Configure Firewall (if needed)

```bash
# Ubuntu (UFW)
sudo ufw allow 5002/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5002/tcp
sudo firewall-cmd --reload

# Or iptables
sudo iptables -A INPUT -p tcp --dport 5002 -j ACCEPT
```

---

## 🔧 Option 2: Manual Deployment

### Prerequisites
- VM with Ubuntu 20.04+ or CentOS 7+
- Python 3.8+
- pip
- Port 5002 available
- SSH access to the VM

### Step 1: Install Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3 python3-pip python3-venv curl

# CentOS/RHEL
sudo yum install -y python3 python3-pip curl
```

### Step 2: Transfer and Setup Application

```bash
# Transfer files (from local machine)
scp -r orchestration-server/ user@your-vm-ip:/home/user/

# On the VM
cd orchestration-server

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install Flask PyYAML
```

### Step 3: Create Systemd Service (for auto-start)

```bash
# Create service file
sudo tee /etc/systemd/system/dvre-orchestration.service > /dev/null <<EOF
[Unit]
Description=DVRE Orchestration Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/orchestration-server
Environment=PATH=/home/$USER/orchestration-server/venv/bin
ExecStart=/home/$USER/orchestration-server/venv/bin/python standalone_server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable dvre-orchestration
sudo systemctl start dvre-orchestration

# Check status
sudo systemctl status dvre-orchestration
```

### Step 4: Configure Firewall and Test

```bash
# Configure firewall (same as Docker option above)
sudo ufw allow 5002/tcp

# Test the service
curl http://localhost:5002/
journalctl -u dvre-orchestration -f  # View logs
```

---

## 🌐 Production Configuration

### Environment Variables

Create a `.env` file for production settings:

```bash
# orchestration-server/.env
FLASK_ENV=production
FLASK_DEBUG=False
SERVER_HOST=0.0.0.0
SERVER_PORT=5002
MAX_WORKERS=4
```

Update `standalone_server.py` to use these:

```python
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == '__main__':
    host = os.getenv('SERVER_HOST', '0.0.0.0')
    port = int(os.getenv('SERVER_PORT', 5002))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    app.run(host=host, port=port, debug=debug)
```

### Nginx Reverse Proxy (Optional)

For production, you might want to use Nginx as a reverse proxy:

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/dvre-orchestration > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/dvre-orchestration /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate (Optional)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

---

## 📊 Monitoring and Maintenance

### Health Check Script

Create a health check script:

```bash
#!/bin/bash
# health_check.sh

ENDPOINT="http://localhost:5002/"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Service is healthy"
    exit 0
else
    echo "❌ Service is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

### Log Management

```bash
# View logs
docker logs dvre-orchestration  # Docker
journalctl -u dvre-orchestration -f  # Systemd

# Log rotation (add to /etc/logrotate.d/dvre-orchestration)
/var/log/dvre-orchestration/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 user user
}
```

### Backup Strategy

```bash
#!/bin/bash
# backup.sh - Backup workflow data

BACKUP_DIR="/backup/dvre-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup workflow files
cp -r /home/user/orchestration-server/workflows $BACKUP_DIR/

# Backup configuration
cp /home/user/orchestration-server/.env $BACKUP_DIR/ 2>/dev/null || true

echo "Backup completed: $BACKUP_DIR"
```

---

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :5002
   sudo kill -9 <PID>
   ```

2. **Permission denied**
   ```bash
   sudo chown -R $USER:$USER /home/$USER/orchestration-server
   chmod +x standalone_server.py
   ```

3. **Service won't start**
   ```bash
   journalctl -u dvre-orchestration -n 50
   sudo systemctl restart dvre-orchestration
   ```

4. **Docker container issues**
   ```bash
   docker logs dvre-orchestration
   docker restart dvre-orchestration
   ```

### Performance Tuning

```bash
# For high-load environments, consider using Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5002 standalone_server:app
```

---

## 🧪 Testing Deployment

Run the test suite on the VM:

```bash
# Copy test script to VM
scp test_orchestration_server.sh user@your-vm-ip:/home/user/orchestration-server/

# On the VM
cd orchestration-server
chmod +x test_orchestration_server.sh
./test_orchestration_server.sh
```

---

## 📋 Deployment Checklist

- [ ] VM provisioned with adequate resources (2GB RAM, 1 CPU minimum)
- [ ] Docker installed (for Docker deployment)
- [ ] Python 3.8+ installed (for manual deployment)
- [ ] Firewall configured to allow port 5002
- [ ] Application files transferred to VM
- [ ] Dependencies installed
- [ ] Service configured to auto-start
- [ ] Health checks working
- [ ] Logs accessible
- [ ] Backup strategy implemented
- [ ] Test suite passes on VM
- [ ] External access verified

---

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Docker deployment
docker pull your-registry/dvre-orchestration-server:latest
docker stop dvre-orchestration
docker rm dvre-orchestration
docker run -d --name dvre-orchestration -p 5002:5002 your-registry/dvre-orchestration-server:latest

# Manual deployment
cd orchestration-server
git pull origin main  # or copy new files
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart dvre-orchestration
```

### Scaling Considerations

For high-traffic scenarios:
- Use load balancer (HAProxy, Nginx)
- Deploy multiple instances
- Use external database for workflow state
- Implement proper logging and monitoring
- Consider Kubernetes for container orchestration

---

This deployment guide provides everything needed to run the DVRE Orchestration Server in production on a VM! 