# AL-Engine - Active Learning Engine

The AL-Engine is a core component of the DVRE (Decentralized Virtual Research Environment) system, responsible for handling active learning training and querying workflows locally. It supports both traditional command-line execution and modern HTTP API server mode for real-time DAL integration.

## Overview

The AL-Engine uses **cwltool** for workflow execution and runs entirely locally. It can run as an HTTP API server for seamless integration with DAL (Decentralized Active Learning) or in traditional batch processing mode.

## Architecture

```
al-engine/
│
├── main.py                      # Main entrypoint with HTTP API server
├── al_iteration.py              # Core training + query script
├── workflow_runner.py           # Executes cwltool workflows locally
├── test_api.py                  # API server testing script
├── test_installation.py         # Installation verification script
├── requirements.txt             # Python dependencies (includes Flask)
├── example_config.json          # Example AL configuration
└── README.md                    # This file
```

## Features

- **🌐 HTTP API Server**: RESTful API for real-time DAL communication
- **📁 File-Based Service Mode**: Traditional signal-based operation (legacy)
- **🤖 Active Learning Workflow**: Complete AL pipeline with uncertainty sampling
- **🔧 CWL Integration**: Uses Common Workflow Language for reproducible workflows
- **📊 Real-time Results**: Immediate API responses with actual sample data
- **🛡️ Robust Error Handling**: Graceful fallbacks and detailed logging
- **🏠 Local Execution Only**: Simplified architecture, no remote dependencies

## Installation

### Prerequisites

- Python 3.8 or higher
- cwltool (for local execution)
- Flask (for HTTP API server)
- Virtual environment (recommended)

### Local Installation

1. **Clone and navigate to AL-Engine directory:**
   ```bash
   cd al-engine
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv al-env
   source al-env/bin/activate  # On Windows: al-env\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Test installation:**
   ```bash
   python test_installation.py
   ```

## Usage

### 🚀 **HTTP API Server Mode (Recommended)**

Start AL-Engine as an HTTP API server for real-time DAL integration:

```bash
python main.py --project_id <project-address> --config ro-crates/<project-address>/config.json --server --port 5050
```

**API Endpoints:**
- `GET /health` - Health check
- `POST /start_iteration` - Start AL iteration
- `GET /status` - Get engine status
- `GET /config` - Get AL configuration
- `GET /results/<iteration>` - Get iteration results

**Example API Usage:**
```bash
# Check if server is running
curl http://localhost:5050/health

# Start an AL iteration
curl -X POST http://localhost:5050/start_iteration \
  -H "Content-Type: application/json" \
  -d '{
    "iteration": 1,
    "project_id": "0x123...",
    "config_override": {
      "n_queries": 2,
      "query_strategy": "uncertainty_sampling"
    }
  }'
```

**Test the API:**
```bash
python test_api.py
```

### 📁 **File-Based Service Mode (Legacy)**

Run in service mode waiting for file-based signals:

```bash
python main.py --project_id <project-address> --config <config.json> --service
```

### ⚡ **Traditional Command-Line Modes**

#### Run a Single Iteration
```bash
python main.py --project_id test-project-1 --config config.json --iteration 1
```

#### Run Full Workflow
```bash
python main.py --project_id test-project-1 --config config.json --workflow
```

## Configuration File

Create a JSON configuration file with AL parameters:

```json
{
  "n_queries": 5,
  "max_iterations": 10,
  "query_strategy": "uncertainty_sampling",
  "model_type": "logistic_regression",
  "solver": "liblinear",
  "label_space": ["positive", "negative"],
  "voting_consensus": "simple_majority",
  "voting_timeout_seconds": 3600
}
```

## DAL Integration

The AL-Engine HTTP API server is designed for seamless integration with the DAL (Decentralized Active Learning) system:

1. **Start AL-Engine Server:**
   ```bash
   cd al-engine
   python main.py --project_id <contract-address> --config ro-crates/<contract-address>/config.json --server
   ```

2. **DAL Communication:**
   - DAL sends HTTP POST requests to `/start_iteration`
   - AL-Engine processes the request and runs CWL workflows locally
   - Returns actual sample data and query indices
   - DAL displays real samples in the labeling interface

3. **Workflow:**
   ```
   DAL → POST /start_iteration → AL-Engine → CWL Execution (Local) → Real Samples → DAL UI
   ```

## API Reference

### POST /start_iteration

Start an active learning iteration.

**Request Body:**
```json
{
  "iteration": 1,
  "project_id": "0x123...",
  "config_override": {
    "n_queries": 2,
    "query_strategy": "uncertainty_sampling",
    "label_space": ["positive", "negative"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "iteration": 1,
  "result": {
    "success": true,
    "outputs": {
      "model_out": "/path/to/model.pkl",
      "query_indices": "/path/to/indices.npy"
    }
  },
  "message": "AL iteration 1 completed successfully"
}
```

### GET /health

Check server health and status.

**Response:**
```json
{
  "status": "healthy",
  "project_id": "test-project",
  "computation_mode": "local",
  "timestamp": 1640995200.0
}
```

## Troubleshooting

### Common Issues

1. **"AL-Engine server is not running"**
   - Make sure the server is started with `--server` flag
   - Check if port 5050 is available
   - Verify Flask is installed: `pip install flask`

2. **"Failed to load configuration"**
   - Ensure config file exists and is valid JSON
   - Check file permissions
   - Verify the config path is correct

3. **"CWL workflow failed"**
   - Install cwltool: `pip install cwltool`
   - Check if required input files exist
   - Verify Python dependencies are installed

### Testing

Run the comprehensive test suite:
```bash
# Test installation
python test_installation.py

# Test API server (requires server to be running)
python test_api.py
```

## Docker Support

Build and run with Docker:

```bash
# Build image
docker build -t al-engine .

# Run API server
docker run -p 5050:5050 -v $(pwd)/data:/app/data al-engine \
  --project_id test-project --config config.json --server
```

## Development

### Adding New Features

1. **New API Endpoints**: Add routes in `ALEngineServer.setup_routes()`
2. **New AL Strategies**: Extend `al_iteration.py`
3. **New Data Sources**: Extend `workflow_runner.py`

### Code Structure

- `ALEngineServer`: HTTP API server class
- `ALEngine`: Legacy command-line class  
- `WorkflowRunner`: CWL execution engine (local only)

## Contributing

1. Follow PEP 8 style guidelines
2. Add tests for new functionality
3. Update documentation
4. Test with both API and command-line modes

## License

DVRE AL-Engine is part of the DVRE project. 