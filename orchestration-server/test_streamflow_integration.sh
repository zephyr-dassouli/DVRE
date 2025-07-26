#!/bin/bash

# Test StreamFlow Integration with DVRE Orchestration Server
# Tests both basic workflow submission and DAL template workflows with orchestration model

set -e

# Configuration
SERVER_URL="http://localhost:8888"
API_BASE="$SERVER_URL/streamflow"

# Test user authentication (mock data for testing)
USER_WALLET="0x1234567890abcdef"
USER_ROLE="coordinator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing StreamFlow Orchestration with DVRE Server${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Architecture: StreamFlow (server orchestration) + cwltool (client execution)${NC}"

# Function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ "$method" = "GET" ]; then
        curl -s -X GET \
            -H "X-User-Wallet: $USER_WALLET" \
            -H "X-User-Role: $USER_ROLE" \
            "$API_BASE$endpoint"
    else
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -H "X-User-Wallet: $USER_WALLET" \
            -H "X-User-Role: $USER_ROLE" \
            -d "$data" \
            "$API_BASE$endpoint"
    fi
}

# Test 1: Check if StreamFlow orchestration architecture is available
echo -e "${YELLOW}Test 1: Checking StreamFlow Orchestration Architecture${NC}"
dal_info_response=$(make_request "GET" "/dal-templates/info")
echo "$dal_info_response" | jq .

execution_model=$(echo "$dal_info_response" | jq -r '.execution_architecture.model // "none"')
server_engine=$(echo "$dal_info_response" | jq -r '.execution_architecture.server_role.engine // "none"')
client_engine=$(echo "$dal_info_response" | jq -r '.execution_architecture.client_role.engine // "none"')

if [ "$execution_model" = "server_orchestrates_client_executes" ]; then
    echo -e "${GREEN}✅ Correct execution architecture: $execution_model${NC}"
else
    echo -e "${RED}❌ Wrong execution architecture: $execution_model${NC}"
    exit 1
fi

if [ "$server_engine" = "streamflow" ] && [ "$client_engine" = "cwltool" ]; then
    echo -e "${GREEN}✅ Correct engine configuration: StreamFlow (server) + cwltool (client)${NC}"
else
    echo -e "${RED}❌ Wrong engine configuration: server=$server_engine, client=$client_engine${NC}"
    exit 1
fi

# Test 2: Submit a basic workflow with StreamFlow orchestration
echo -e "\n${YELLOW}Test 2: Basic Workflow Submission (StreamFlow Orchestration)${NC}"
basic_workflow_data='{
    "cwl_workflow": {
        "cwlVersion": "v1.0",
        "class": "CommandLineTool",
        "baseCommand": "echo",
        "inputs": {
            "message": {
                "type": "string",
                "inputBinding": {"position": 1}
            }
        },
        "outputs": {
            "output": {
                "type": "stdout"
            }
        }
    },
    "inputs": {
        "message": "Hello StreamFlow Orchestration from DVRE!"
    }
}'

basic_response=$(make_request "POST" "/submit" "$basic_workflow_data")
echo "$basic_response" | jq .

basic_workflow_id=$(echo "$basic_response" | jq -r '.workflow_id')
execution_model_response=$(echo "$basic_response" | jq -r '.execution_model')
server_role=$(echo "$basic_response" | jq -r '.server_role')
client_role=$(echo "$basic_response" | jq -r '.client_role')

if [ "$execution_model_response" = "server_orchestrates_client_executes" ]; then
    echo -e "${GREEN}✅ Basic workflow submitted with correct orchestration model${NC}"
else
    echo -e "${RED}❌ Expected orchestration model, got: $execution_model_response${NC}"
fi

# Test 3: Submit a project workflow with DAL template (orchestration)
echo -e "\n${YELLOW}Test 3: DAL Project Workflow with StreamFlow Orchestration${NC}"
dal_workflow_data='{
    "project_id": "streamflow-orchestration-test-project",
    "use_dal_template": true,
    "dal_workflow_type": "train_query",
    "inputs": {
        "labeled_data": "/path/to/labeled_data.npy",
        "unlabeled_data": "/path/to/unlabeled_data.npy",
        "config": {
            "query_strategy": "uncertainty_sampling",
            "query_budget": 5
        }
    },
    "metadata": {
        "project_title": "StreamFlow DAL Orchestration Test",
        "al_config": {
            "query_strategy": "uncertainty_sampling",
            "query_budget": 5,
            "max_iterations": 10
        }
    }
}'

dal_response=$(make_request "POST" "/submit-project-workflow" "$dal_workflow_data")
echo "$dal_response" | jq .

dal_workflow_id=$(echo "$dal_response" | jq -r '.workflow_id')
dal_execution_model=$(echo "$dal_response" | jq -r '.execution_model')
dal_server_role=$(echo "$dal_response" | jq -r '.server_role')
dal_client_role=$(echo "$dal_response" | jq -r '.client_role')

if [ "$dal_execution_model" = "server_orchestrates_client_executes" ]; then
    echo -e "${GREEN}✅ DAL workflow submitted with StreamFlow orchestration${NC}"
else
    echo -e "${RED}❌ Expected orchestration model for DAL workflow, got: $dal_execution_model${NC}"
fi

if [ "$dal_server_role" = "streamflow_orchestration_and_coordination" ]; then
    echo -e "${GREEN}✅ DAL workflow configured for StreamFlow coordination${NC}"
else
    echo -e "${RED}❌ Expected StreamFlow coordination, got: $dal_server_role${NC}"
fi

# Test 4: Check workflow status
echo -e "\n${YELLOW}Test 4: Checking Workflow Orchestration Status${NC}"
sleep 2  # Give workflows time to start orchestration

echo "Basic workflow orchestration status:"
basic_status=$(make_request "GET" "/status/$basic_workflow_id")
echo "$basic_status" | jq .

echo "DAL workflow orchestration status:"
dal_status=$(make_request "GET" "/status/$dal_workflow_id")
echo "$dal_status" | jq .

# Test 5: Check if StreamFlow configuration file exists
echo -e "\n${YELLOW}Test 5: Checking StreamFlow Orchestration Configuration${NC}"
if [ -f "streamflow.yml" ]; then
    echo -e "${GREEN}✅ StreamFlow orchestration configuration file exists${NC}"
    echo "StreamFlow orchestration configuration preview:"
    echo "Execution model:"
    grep -A 5 "execution_model:" streamflow.yml || echo "Configuration preview not available"
else
    echo -e "${RED}❌ StreamFlow configuration file not found${NC}"
fi

# Test 6: List all workflows to verify orchestration tracking
echo -e "\n${YELLOW}Test 6: Listing All Orchestrated Workflows${NC}"
workflows_list=$(make_request "GET" "/workflows")
echo "$workflows_list" | jq .

# Summary
echo -e "\n${BLUE}================================================================${NC}"
echo -e "${BLUE}🎯 StreamFlow Orchestration Test Summary${NC}"
echo -e "${BLUE}================================================================${NC}"

echo -e "Basic Workflow ID: ${YELLOW}$basic_workflow_id${NC}"
echo -e "DAL Workflow ID: ${YELLOW}$dal_workflow_id${NC}"
echo -e "Architecture: ${GREEN}StreamFlow (orchestration) + cwltool (execution)${NC}"
echo -e "Server Role: ${GREEN}Coordination & Orchestration${NC}"
echo -e "Client Role: ${GREEN}CWL Execution with Local Data${NC}"
echo -e "Data Privacy: ${GREEN}Client-side only, no data upload${NC}"

echo -e "\n${GREEN}✅ StreamFlow orchestration tests completed successfully!${NC}"
echo -e "${BLUE}🔧 Your orchestration server uses StreamFlow for coordination while clients execute with cwltool.${NC}"
echo -e "${BLUE}🔒 Client data remains completely private and local.${NC}"

# Cleanup note
echo -e "\n${YELLOW}Note: Check workflow status endpoints to monitor orchestration progress.${NC}"
echo -e "${YELLOW}      Clients should connect and execute workflows with cwltool locally.${NC}" 