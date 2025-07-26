# Flask Version Archive

This directory contains the archived Flask-based implementation of the DVRE Orchestration Server.

## What was archived

- `standalone_server.py` - Flask-based orchestration server

## Why it was archived

The orchestration server was migrated from Flask to Jupyter Server for the following reasons:

### ✅ **Jupyter Server Benefits:**
1. **Better Integration**: Native integration with JupyterLab ecosystem
2. **Extension System**: Proper Jupyter server extension with auto-discovery
3. **Tornado Framework**: Built on robust Tornado async framework for better performance
4. **Authentication**: Can leverage Jupyter's built-in authentication system
5. **Research Environment**: Better suited for multi-user research environments
6. **Standardization**: Follows Jupyter ecosystem patterns and conventions

### 📊 **Architecture Comparison:**

**Flask Version (Archived):**
```
DAL dApp → HTTP API → standalone_server.py (Flask) → CWL workflows
```

**Jupyter Version (Current):**
```
DAL dApp → HTTP API → Jupyter Server → streamflow_handler.py → CWL workflows
```

## Migration Details

All functionality from the Flask version has been migrated to the Jupyter-based implementation in `src/streamflow_handler.py`:

- ✅ Workflow submission and monitoring
- ✅ Two-Phase Active Learning orchestration
- ✅ AL-engine command processing
- ✅ Session management
- ✅ Project context handling
- ✅ IPFS integration
- ✅ Error handling and logging

## If you need to reference the Flask version

The Flask implementation can be found in this archive for reference purposes. However, **the current production system uses the Jupyter-based implementation**.

For current development, please use:
- `src/streamflow_handler.py` - Main Jupyter extension
- `deploy.sh` - Jupyter-based deployment script
- `test_orchestration_server.sh` - Test suite (updated for Jupyter endpoints)

## Deployment

The current system deploys using:
```bash
./deploy.sh --port 5004
```

This creates a Jupyter Server container with the orchestration extension loaded automatically. 