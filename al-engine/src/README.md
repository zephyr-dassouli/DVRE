# AL-Engine - Refactored Architecture

The AL-Engine has been refactored into smaller, modular files for better maintainability and organization.

## Documentation

- **[Class Imbalance Handling](../CLASS_IMBALANCE_HANDLING.md)** - Comprehensive guide on how the AL-Engine handles class imbalance scenarios, small datasets, and performance evaluation strategies

## File Structure

### Core Files

- **`main.py`** (72 lines) - Entry point and command line argument parsing
- **`server.py`** (372 lines) - ALEngineServer class for HTTP API server mode
- **`endpoints.py`** (238 lines) - Flask route handlers and API endpoints
- **`engine.py`** (557 lines) - Legacy ALEngine class for backward compatibility

### Supporting Files

- **`workflow_runner.py`** (271 lines) - CWL workflow execution
- **`al_iteration.py`** (142 lines) - AL iteration logic
- **`__init__.py`** (38 lines) - Package initialization

## API Endpoints

The refactored AL-Engine provides the following HTTP API endpoints:

### Core Endpoints
- `GET /health` - Health check
- `GET /status` - AL-Engine status
- `GET /config` - Current AL configuration
- `POST /start_iteration` - Start AL iteration
- `POST /submit_labels` - Submit labeled samples

### Data Retrieval
- `GET /results/<iteration>` - Get iteration results
- `GET /model_performance/<iteration>` - Get real model performance metrics

## Key Improvements

### [MODULAR] **Modular Architecture**
- **Separation of concerns**: API endpoints, business logic, and legacy support are now in separate files
- **Easier maintenance**: Each file has a specific responsibility
- **Better testability**: Individual components can be tested in isolation

### [PERFORMANCE] **Real Performance Metrics** 
- Added `/model_performance/<iteration>` endpoint for retrieving actual ML model performance
- Supports reading performance metrics from `performance_round_{iteration}.json` files
- Replaces the mock data implementation in the frontend

### [COMPATIBILITY] **Backwards Compatibility**
- Legacy ALEngine class preserved for existing scripts
- All original functionality maintained
- Same command line interface

## Usage Examples

### HTTP API Server Mode (Recommended)
```bash
python main.py --server --port 5050
```

### Legacy File-based Service Mode
```bash
python main.py --project_id <project_addr> --config config.json --service
```

### One-shot Execution
```bash
python main.py --project_id <project_addr> --config config.json --iteration 1
```

## Architecture Benefits

1. **Maintainability**: Code is organized by responsibility
2. **Scalability**: Easy to add new endpoints or modify existing ones
3. **Testing**: Individual components can be unit tested
4. **Documentation**: Each file has a clear purpose
5. **Performance**: No change in runtime performance

## Migration Notes

- **No breaking changes**: All existing interfaces are preserved
- **API additions**: New model performance endpoint available
- **File structure**: Main logic moved to separate modules
- **Import structure**: Legacy code can import from new modules if needed 