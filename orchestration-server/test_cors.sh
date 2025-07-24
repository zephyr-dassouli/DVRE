#!/bin/bash

echo "=== CORS Testing Script ==="
echo "Testing CORS headers and preflight requests..."

SERVER_URL="http://145.100.135.97:5004"

echo -e "\n1. Testing OPTIONS preflight request:"
curl -v -X OPTIONS \
  -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "$SERVER_URL/streamflow/workflows" 2>&1 | grep -E "(HTTP|Access-Control|Origin)"

echo -e "\n2. Testing GET request with Origin header:"
curl -v -X GET \
  -H "Origin: http://example.com" \
  "$SERVER_URL/streamflow/workflows" 2>&1 | grep -E "(HTTP|Access-Control|Origin)"

echo -e "\n3. Testing POST request with CORS headers:"
curl -v -X POST \
  -H "Origin: http://example.com" \
  -H "Content-Type: application/json" \
  -d '{"cwl_workflow": "{\"cwlVersion\": \"v1.0\", \"class\": \"CommandLineTool\", \"baseCommand\": \"echo\"}", "inputs": {"message": "CORS test"}}' \
  "$SERVER_URL/streamflow/submit" 2>&1 | grep -E "(HTTP|Access-Control|Origin)"

echo -e "\n4. Testing HEAD request:"
curl -v -I \
  -H "Origin: http://example.com" \
  "$SERVER_URL/streamflow/workflows" 2>&1 | grep -E "(HTTP|Access-Control|Origin)"

echo -e "\n5. Testing API documentation endpoint:"
curl -v -I \
  -H "Origin: http://example.com" \
  "$SERVER_URL/" 2>&1 | grep -E "(HTTP|Access-Control|Origin)"

echo -e "\n✅ CORS testing completed!" 