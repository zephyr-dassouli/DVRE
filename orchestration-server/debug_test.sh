#!/bin/bash

# Simple debug test for DVRE Orchestration Server
echo "=== DVRE Server Debug Test ==="

# Check dependencies
echo "1. Checking dependencies..."
python3 -c "import flask, yaml" 2>/dev/null && echo "✅ Dependencies OK" || {
    echo "❌ Dependencies missing, installing..."
    pip install Flask PyYAML
}

# Check if server script exists
echo "2. Checking server script..."
if [ -f "standalone_server.py" ]; then
    echo "✅ Server script found"
else
    echo "❌ Server script not found"
    exit 1
fi

# Check if port 5002 is available
echo "3. Checking port availability..."
if lsof -i :5002 >/dev/null 2>&1; then
    echo "⚠️  Port 5002 is in use, killing existing processes..."
    pkill -f standalone_server.py 2>/dev/null || true
    sleep 2
fi

# Start server
echo "4. Starting server..."
python3 standalone_server.py > server_debug.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait and check if process is still running
sleep 5
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server process is running"
else
    echo "❌ Server process died, checking logs:"
    cat server_debug.log
    exit 1
fi

# Test connectivity
echo "5. Testing connectivity..."
for i in {1..10}; do
    if curl -s --max-time 2 http://localhost:5002/ >/dev/null; then
        echo "✅ Server is responding"
        break
    else
        echo "⏳ Attempt $i/10 - waiting for server..."
        sleep 1
    fi
done

# Test a simple API call
echo "6. Testing API..."
response=$(curl -s http://localhost:5002/ 2>/dev/null)
if echo "$response" | grep -q "DVRE"; then
    echo "✅ API is working"
    echo "Response preview:"
    echo "$response" | head -3
else
    echo "❌ API not working"
    echo "Response:"
    echo "$response"
fi

# Clean up
echo "7. Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
rm -f server_debug.log

echo "=== Debug test complete ===" 