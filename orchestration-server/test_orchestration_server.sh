#!/bin/bash

# DVRE Orchestration Server Test Suite
# This script tests all functionality of the standalone orchestration server

# set -e  # Exit on any error - COMMENTED OUT to allow better debugging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_PORT=5004
SERVER_URL="http://localhost:${SERVER_PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Test results tracking
TESTS_PASSED=0
TESTS_TOTAL=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_TOTAL++))
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if jq is available for JSON parsing, if not use python
check_json_parser() {
    if command -v jq >/dev/null 2>&1; then
        JSON_PARSER="jq ."
    else
        JSON_PARSER="python3 -m json.tool"
    fi
}

# Start the server (or verify it's running)
start_server() {
    print_header "Checking DVRE Jupyter Orchestration Server"
    
    # Check if Docker container is running
    if docker ps | grep -q orchestration-server; then
        print_success "Jupyter orchestration server container is running"
    else
        print_info "Starting Jupyter orchestration server container..."
        if docker start orchestration-server 2>/dev/null; then
            print_success "Container started"
            sleep 10  # Give it time to initialize
        else
            print_failure "Failed to start container. Please run: ./deploy.sh --port $SERVER_PORT"
            exit 1
        fi
    fi
    
    # Test if server is responding on Jupyter endpoint
    print_info "Testing server connectivity..."
    for i in {1..10}; do
        if curl -s --max-time 5 "$SERVER_URL/tree" >/dev/null 2>&1; then
            print_success "Jupyter server is responding on port $SERVER_PORT"
            return 0
        else
            if [ $i -eq 10 ]; then
                print_failure "Server not responding after 10 attempts"
                print_info "Container logs:"
                docker logs --tail 10 orchestration-server || true
                exit 1
            fi
            print_info "Attempt $i/10 - waiting for server..."
            sleep 2
        fi
    done
}

# Stop the server (just a cleanup function now)
stop_server() {
    print_header "Cleaning Up"
    print_info "Jupyter server continues running (managed by Docker)"
    print_info "To stop: docker stop orchestration-server"
    print_info "To restart: docker start orchestration-server"
}

# Test 1: API Documentation
test_api_documentation() {
    print_header "Test 1: API Documentation"
    
    local response=$(curl -s "$SERVER_URL/")
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/")
    
    if [ "$status_code" == "200" ]; then
        echo "$response" | $JSON_PARSER > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            print_success "API documentation endpoint working"
            echo "$response" | $JSON_PARSER | head -10
        else
            print_failure "Invalid JSON response from documentation endpoint"
        fi
    else
        print_failure "Documentation endpoint returned status code: $status_code"
    fi
}

# Test 2: Workflow Submission
test_workflow_submission() {
    print_header "Test 2: Workflow Submission"
    
    local payload='{
        "cwl_workflow": "#!/usr/bin/env cwl-runner\ncwlVersion: v1.0\nclass: CommandLineTool\nbaseCommand: echo\ninputs:\n  message:\n    type: string\n    inputBinding:\n      position: 1\noutputs:\n  result:\n    type: stdout\nstdout: output.txt",
        "inputs": {
            "message": "Hello from DVRE Test Suite!"
        }
    }'
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    if [ "$status_code" == "200" ]; then
        # Extract workflow ID for later tests
        if command -v jq >/dev/null 2>&1; then
            WORKFLOW_ID_1=$(echo "$response" | jq -r '.workflow_id')
        else
            WORKFLOW_ID_1=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['workflow_id'])")
        fi
        
        if [ "$WORKFLOW_ID_1" != "null" ] && [ ! -z "$WORKFLOW_ID_1" ]; then
            print_success "Workflow submission working"
            echo "$response" | $JSON_PARSER
            echo "Workflow ID: $WORKFLOW_ID_1"
        else
            print_failure "No workflow ID returned"
        fi
    else
        print_failure "Workflow submission returned status code: $status_code"
    fi
}

# Test 3: Workflow Status Checking
test_workflow_status() {
    print_header "Test 3: Workflow Status Checking"
    
    if [ -z "$WORKFLOW_ID_1" ]; then
        print_failure "No workflow ID available for status test"
        return
    fi
    
    # Wait a moment for processing
    sleep 2
    
    local response=$(curl -s "$SERVER_URL/streamflow/status/$WORKFLOW_ID_1")
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/streamflow/status/$WORKFLOW_ID_1")
    
    if [ "$status_code" == "200" ]; then
        print_success "Workflow status checking working"
        echo "$response" | $JSON_PARSER
        
        # Check if workflow completed
        if command -v jq >/dev/null 2>&1; then
            local workflow_status=$(echo "$response" | jq -r '.status')
        else
            local workflow_status=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
        fi
        
        if [ "$workflow_status" == "COMPLETED" ]; then
            print_success "Workflow processing completed successfully"
        else
            print_info "Workflow status: $workflow_status"
        fi
    else
        print_failure "Status check returned status code: $status_code"
    fi
}

# Test 4: Multiple Workflow Handling
test_multiple_workflows() {
    print_header "Test 4: Multiple Workflow Handling"
    
    local payload='{
        "cwl_workflow": "active-learning-workflow-test",
        "inputs": {
            "dataset": "QmZ4tDuvesekSs4qM5Z8jGWkTv74SFzNVpM2wuVnB94oEa",
            "model": "neural-network",
            "strategy": "uncertainty-sampling",
            "iterations": 5
        }
    }'
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    if [ "$status_code" == "200" ]; then
        if command -v jq >/dev/null 2>&1; then
            WORKFLOW_ID_2=$(echo "$response" | jq -r '.workflow_id')
        else
            WORKFLOW_ID_2=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['workflow_id'])")
        fi
        
        print_success "Second workflow submitted successfully"
        echo "$response" | $JSON_PARSER
        echo "Second Workflow ID: $WORKFLOW_ID_2"
    else
        print_failure "Second workflow submission failed with status code: $status_code"
    fi
}

# Test 5: Workflow Listing
test_workflow_listing() {
    print_header "Test 5: Workflow Listing"
    
    # Wait for processing
    sleep 1
    
    local response=$(curl -s "$SERVER_URL/streamflow/workflows")
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/streamflow/workflows")
    
    if [ "$status_code" == "200" ]; then
        print_success "Workflow listing working"
        echo "$response" | $JSON_PARSER
        
        # Count workflows
        if command -v jq >/dev/null 2>&1; then
            local workflow_count=$(echo "$response" | jq '.workflows | length')
        else
            local workflow_count=$(echo "$response" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['workflows']))")
        fi
        
        if [ "$workflow_count" -ge 2 ]; then
            print_success "Multiple workflows listed correctly ($workflow_count workflows)"
        else
            print_info "Found $workflow_count workflow(s)"
        fi
    else
        print_failure "Workflow listing returned status code: $status_code"
    fi
}

# Test 6: Error Handling - Non-existent Workflow
test_error_handling_404() {
    print_header "Test 6: Error Handling (404 - Not Found)"
    
    local response=$(curl -s "$SERVER_URL/streamflow/status/non-existent-workflow-id")
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/streamflow/status/non-existent-workflow-id")
    
    if [ "$status_code" == "404" ]; then
        print_success "404 error handling working correctly"
        echo "$response" | $JSON_PARSER
    else
        print_failure "Expected 404, got status code: $status_code"
    fi
}

# Test 7: Error Handling - Malformed Request
test_error_handling_400() {
    print_header "Test 7: Error Handling (400 - Bad Request)"
    
    local payload='{"inputs": {"hash": "test"}}'  # Missing cwl_workflow
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SERVER_URL/streamflow/submit")
    
    if [ "$status_code" == "400" ]; then
        print_success "400 error handling working correctly"
        echo "$response" | $JSON_PARSER
    else
        print_failure "Expected 400, got status code: $status_code"
    fi
}

# Test 8: Performance Test
test_performance() {
    print_header "Test 8: Performance Test (5 concurrent workflows)"
    
    local start_time=$(date +%s)
    
    # Submit 5 workflows concurrently and store their PIDs
    local curl_pids=()
    for i in {1..5}; do
        local payload="{
            \"cwl_workflow\": \"performance-test-workflow-$i\",
            \"inputs\": {
                \"test_id\": \"perf-test-$i\",
                \"timestamp\": \"$(date -Iseconds)\"
            }
        }"
        
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "$SERVER_URL/streamflow/submit" &
        curl_pids+=($!)
    done
    
    # Wait only for the curl processes to complete
    for pid in "${curl_pids[@]}"; do
        wait $pid 2>/dev/null || true
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Check final workflow count
    sleep 2  # Allow processing time
    local response=$(curl -s "$SERVER_URL/streamflow/workflows")
    
    if command -v jq >/dev/null 2>&1; then
        local total_workflows=$(echo "$response" | jq '.workflows | length')
    else
        local total_workflows=$(echo "$response" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['workflows']))")
    fi
    
    if [ "$total_workflows" -ge 7 ]; then  # 2 from previous tests + 5 new
        print_success "Performance test passed ($total_workflows workflows, ${duration}s)"
    else
        print_failure "Performance test failed (only $total_workflows workflows found)"
    fi
}

# Print final results
print_results() {
    print_header "Test Results Summary"
    
    echo -e "\n${BLUE}Tests Completed: $TESTS_TOTAL${NC}"
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $((TESTS_TOTAL - TESTS_PASSED))${NC}"
    
    if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED! DVRE Orchestration Server is fully functional!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Please check the output above.${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo "DVRE Orchestration Server Test Suite"
    echo "====================================="
    
    # Setup
    check_json_parser
    
    # Trap to ensure cleanup on exit
    trap stop_server EXIT
    
    # Run tests
    start_server
    test_api_documentation
    test_workflow_submission
    test_workflow_status
    test_multiple_workflows
    test_workflow_listing
    test_error_handling_404
    test_error_handling_400
    test_performance
    
    # Results
    print_results
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 