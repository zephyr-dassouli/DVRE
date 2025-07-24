# DVRE Orchestration Server Testing Guide

This directory contains a complete orchestration server for the Decentralized Virtual Research Environment (D-VRE) and comprehensive testing tools.

## Quick Test

To run all tests with a single command:

```bash
./test_orchestration_server.sh
```

## What Gets Tested

The test suite verifies all aspects of the orchestration server:

### 🔧 **Core Functionality**
1. **API Documentation** - `/` endpoint returns proper API docs
2. **Workflow Submission** - `POST /streamflow/submit` accepts CWL workflows
3. **Status Monitoring** - `GET /streamflow/status/<id>` tracks workflow progress
4. **Multiple Workflows** - Server handles concurrent workflow submissions
5. **Workflow Listing** - `GET /streamflow/workflows` shows all workflows

### 🛡️ **Error Handling**
6. **404 Errors** - Non-existent workflows return proper error codes
7. **400 Errors** - Malformed requests are handled gracefully

### ⚡ **Performance**
8. **Concurrent Processing** - 5 simultaneous workflows are processed correctly

## Test Output

The script provides colored output:
- 🟢 **Green**: Tests that passed
- 🔴 **Red**: Tests that failed  
- 🔵 **Blue**: Section headers
- 🟡 **Yellow**: Information messages

Example successful run:
```
=== Test 1: API Documentation ===
✅ API documentation endpoint working

=== Test 2: Workflow Submission ===
✅ Workflow submission working
Workflow ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890

=== Test Results Summary ===
Tests Completed: 8
Tests Passed: 8
Tests Failed: 0

🎉 ALL TESTS PASSED! DVRE Orchestration Server is fully functional!
```

## Manual Testing

You can also test individual components manually:

### Start the Server
```bash
python3 standalone_server.py
```

### Test API Endpoints
```bash
# API Documentation
curl http://localhost:5001/

# Submit a workflow
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "cwl_workflow": "#!/usr/bin/env cwl-runner\ncwlVersion: v1.0\nclass: CommandLineTool\nbaseCommand: echo",
    "inputs": {"message": "Hello World"}
  }' \
  http://localhost:5001/streamflow/submit

# Check workflow status (replace with actual workflow ID)
curl http://localhost:5001/streamflow/status/YOUR_WORKFLOW_ID

# List all workflows
curl http://localhost:5001/streamflow/workflows
```

## Files Overview

| File | Purpose |
|------|---------|
| `standalone_server.py` | Main orchestration server (Flask-based) |
| `test_orchestration_server.sh` | Comprehensive test suite |
| `streamflow_handler.py` | Jupyter server extension handlers |
| `Dockerfile` | Container configuration |
| `requirements.txt` | Python dependencies |

## Architecture

```
┌─────────────────┐    HTTP API    ┌───────────────────────┐
│   DAL Client    │───────────────>│  Orchestration Server │
│ (JupyterLab UI) │                │   (Flask/Jupyter)     │
└─────────────────┘                └───────────────────────┘
                                             │
                                             v
                                   ┌─────────────────┐
                                   │ CWL Workflows   │
                                   │ (StreamFlow)    │  
                                   └─────────────────┘
```

## Integration with D-VRE

This orchestration server serves as the backend component of the D-VRE system:

1. **DAL Extension** (JupyterLab frontend) submits workflows via REST API
2. **Orchestration Server** receives, manages, and executes workflows
3. **StreamFlow/CWL** handles actual workflow execution
4. **Status Updates** provide real-time feedback to users

## Requirements

- Python 3.8+
- Flask
- PyYAML
- curl (for testing)
- Optional: jq (for prettier JSON output)

## Troubleshooting

### Port 5001 in use
```bash
# Kill any existing servers
pkill -f standalone_server.py

# Or change the port in standalone_server.py
# Change: app.run(host='0.0.0.0', port=5001, debug=True)
# To:    app.run(host='0.0.0.0', port=5002, debug=True)
```

### Missing dependencies
```bash
pip install Flask PyYAML
```

### Permission denied
```bash
chmod +x test_orchestration_server.sh
```

## Development

To modify the server or add new tests:

1. **Add new endpoints** in `standalone_server.py`
2. **Add corresponding tests** in `test_orchestration_server.sh`
3. **Update API documentation** in the home endpoint
4. **Run tests** to ensure everything works

## Success Criteria

All tests should pass for the orchestration server to be considered functional:
- ✅ All 8 test cases pass
- ✅ No error messages in output
- ✅ Server starts and stops cleanly
- ✅ Workflows process from PENDING → RUNNING → COMPLETED

## Next Steps

Once testing passes, you can:
1. **Integrate with blockchain** by connecting to your Besu node
2. **Deploy in production** using the Docker container
3. **Connect DAL frontend** to submit real CWL workflows
4. **Scale with orchestration** using Kubernetes or Docker Swarm 