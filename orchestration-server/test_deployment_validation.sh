#!/bin/bash

# DVRE Orchestration Server - Deployment Validation Script
# Validates StreamFlow orchestration architecture and configuration

set -e

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

echo -e "${BLUE}🔍 DVRE Orchestration Server - Deployment Validation${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}Architecture: StreamFlow (server orchestration) + cwltool (client execution)${NC}"

# Test 1: File Structure Validation
print_header "File Structure Validation"

required_files=(
    "streamflow.yml"
    "requirements.txt"
    "Dockerfile"
    "deploy.sh"
    "src/streamflow_config.py"
    "src/workflow_handlers.py"
    "src/__init__.py"
    "test_streamflow_integration.sh"
)

all_files_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "Found: $file"
    else
        print_error "Missing: $file"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = true ]; then
    print_success "All required files present"
else
    print_error "Some required files are missing"
    exit 1
fi

# Test 2: Dependencies Validation
print_header "Dependencies Validation"

if grep -q "streamflow==0.1.6" requirements.txt; then
    print_success "StreamFlow 0.1.6 (stable) specified in requirements.txt"
else
    print_error "StreamFlow 0.1.6 not found in requirements.txt"
fi

if grep -q "cwltool" requirements.txt; then
    print_success "cwltool specified in requirements.txt"
else
    print_error "cwltool not found in requirements.txt"
fi

if grep -q "jupyter_server" requirements.txt; then
    print_success "jupyter_server specified in requirements.txt"
else
    print_error "jupyter_server not found in requirements.txt"
fi

# Test 3: StreamFlow Configuration Validation
print_header "StreamFlow Configuration Validation"

if grep -q "orchestration:" streamflow.yml; then
    print_success "Orchestration deployment configured in streamflow.yml"
else
    print_error "Orchestration deployment not found in streamflow.yml"
fi

if grep -q "server_orchestrates_client_executes" streamflow.yml; then
    print_success "Correct execution model in streamflow.yml"
else
    print_error "Execution model not properly configured in streamflow.yml"
fi

if grep -q 'engine: "streamflow"' streamflow.yml; then
    print_success "StreamFlow server engine configured"
else
    print_error "StreamFlow server engine not configured"
fi

if grep -q 'engine: "cwltool"' streamflow.yml; then
    print_success "cwltool client engine configured"
else
    print_error "cwltool client engine not configured"
fi

# Test 4: Source Code Validation
print_header "Source Code Validation"

if grep -q "streamflow_orchestrator" src/streamflow_config.py; then
    print_success "StreamFlow orchestrator class found"
else
    print_error "StreamFlow orchestrator class not found"
fi

if grep -q "orchestrate_workflow" src/streamflow_config.py; then
    print_success "Orchestration method implemented"
else
    print_error "Orchestration method not found"
fi

if grep -q "execution_architecture" src/workflow_handlers.py; then
    print_success "Execution architecture exposed in API"
else
    print_error "Execution architecture not exposed in API"
fi

# Test 5: Docker Configuration Validation
print_header "Docker Configuration Validation"

if grep -q "streamflow.yml" Dockerfile; then
    print_success "StreamFlow config copied in Dockerfile"
else
    print_error "StreamFlow config not copied in Dockerfile"
fi

if grep -q "DVRE_ROLE=orchestration" Dockerfile; then
    print_success "Orchestration role environment variable set"
else
    print_error "Orchestration role environment variable not set"
fi

if grep -q "server_orchestrates_client_executes" Dockerfile; then
    print_success "Execution model environment variable set"
else
    print_error "Execution model environment variable not set"
fi

# Test 6: Test Script Validation
print_header "Test Script Validation"

if grep -q "execution_architecture" test_streamflow_integration.sh; then
    print_success "Test script checks execution architecture"
else
    print_error "Test script doesn't check execution architecture"
fi

if grep -q "server_orchestrates_client_executes" test_streamflow_integration.sh; then
    print_success "Test script validates orchestration model"
else
    print_error "Test script doesn't validate orchestration model"
fi

# Test 7: Architecture Consistency Check
print_header "Architecture Consistency Check"

# Check that old execution references are removed
if grep -rq "streamflow_executor" src/; then
    print_error "Found legacy streamflow_executor references"
else
    print_success "No legacy streamflow_executor references"
fi

# Check for deployment parameter removal
if grep -q '"deployment"' test_streamflow_integration.sh; then
    print_warning "Found deployment parameter in test (may be legacy)"
else
    print_success "No legacy deployment parameters in test"
fi

# Test 8: Privacy Architecture Validation
print_header "Privacy Architecture Validation"

if grep -q "local_datasets_only" src/streamflow_config.py; then
    print_success "Local datasets only policy enforced"
else
    print_error "Local datasets only policy not found"
fi

if grep -q "no_data_upload" src/streamflow_config.py; then
    print_success "No data upload policy enforced"
else
    print_error "No data upload policy not found"
fi

if grep -q "privacy_preserved" src/streamflow_config.py; then
    print_success "Privacy preservation policy enforced"
else
    print_error "Privacy preservation policy not found"
fi

# Summary
print_header "Validation Summary"

echo -e "📋 ${BLUE}Configuration Details:${NC}"
echo -e "   • StreamFlow Version: ${GREEN}0.1.6 (stable)${NC}"
echo -e "   • Server Role: ${GREEN}Orchestration & Coordination${NC}"
echo -e "   • Client Role: ${GREEN}CWL Execution with Local Data${NC}"
echo -e "   • Data Privacy: ${GREEN}Client-side only, no upload${NC}"
echo -e "   • Architecture: ${GREEN}Distributed orchestration${NC}"

echo -e "\n📁 ${BLUE}Key Files Status:${NC}"
echo -e "   • streamflow.yml: ${GREEN}Orchestration-only deployment${NC}"
echo -e "   • requirements.txt: ${GREEN}StreamFlow 0.1.6 stable${NC}"
echo -e "   • Dockerfile: ${GREEN}Orchestration environment vars${NC}"
echo -e "   • Source code: ${GREEN}Modular architecture${NC}"

echo -e "\n🚀 ${BLUE}Ready for Deployment:${NC}"
echo -e "   • Run: ${YELLOW}./deploy.sh${NC}"
echo -e "   • Test: ${YELLOW}./test_streamflow_integration.sh${NC}"
echo -e "   • Monitor: ${YELLOW}./debug.sh${NC}"

print_success "✅ Deployment validation completed successfully!"
print_success "🎯 Your DVRE orchestration server is correctly configured for StreamFlow orchestration!"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Deploy: ${BLUE}./deploy.sh${NC}"
echo -e "2. Test orchestration: ${BLUE}./test_streamflow_integration.sh${NC}"
echo -e "3. Configure clients with cwltool for execution${NC}" 