# AL-Engine - Active Learning Engine

The AL-Engine is a core component of the DVRE (Decentralized Virtual Research Environment) system, responsible for handling active learning training and querying workflows.

## Overview

The AL-Engine uses **cwltool** for workflow execution and supports both local and remote computation modes. It receives necessary files when a project gets deployed and manages the complete active learning lifecycle.

## Architecture

```
al-engine/
│
├── al_iteration.py              # Core training + query script
├── main.py                      # Main entrypoint for engine
├── orchestrator_client.py       # Handles communication with orchestrator
├── workflow_runner.py           # Executes cwltool workflows
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Container configuration (optional)
└── README.md                    # This file
```

## Features

- **Local and Remote Execution**: Support for both local cwltool execution and remote orchestrator submission
- **Active Learning Workflow**: Complete AL pipeline with uncertainty sampling
- **CWL Integration**: Uses Common Workflow Language for reproducible workflows
- **Modular Design**: Clean separation between workflow execution and orchestration
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Installation

### Prerequisites

- Python 3.8 or higher
- cwltool (for local execution)
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

### Docker Installation

1. **Build Docker image:**
   ```bash
   docker build -t al-engine .
   ```

2. **Run container:**
   ```bash
   docker run -v $(pwd)/data:/app/data -v $(pwd)/outputs:/app/outputs al-engine
   ```

## Usage

### Basic Commands

The AL-Engine provides several execution modes:

#### Run a Single Iteration

```bash
python main.py --project_id test-project-1 --config config.json --iteration 1
```

#### Run Full Workflow

```bash
python main.py --project_id test-project-1 --config config.json --workflow
```

#### Remote Execution

```bash
python main.py --project_id test-project-1 --config config.json --mode remote --workflow
```

### Configuration File

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

### Data File Structure

The AL-Engine expects the following input files for each iteration:

- `labeled_data_iter_{n}.npy` - Labeled training features
- `labeled_labels_iter_{n}.npy` - Labeled training labels  
- `unlabeled_data_iter_{n}.npy` - Unlabeled pool for querying
- `model_iter_{n-1}.pkl` - Previous iteration model (optional for first iteration)

### Output Files

Each iteration produces:

- `model_out.pkl` - Trained model
- `query_indices.npy` - Indices of samples to label next
- `performance_iter_{n}.json` - Model performance metrics (if available)

## Integration with DVRE

The AL-Engine integrates with the DVRE system through:

1. **Project Deployment**: Receives configuration and initial data when projects are deployed
2. **Smart Contracts**: Updates iteration status and results to blockchain
3. **Orchestrator**: Submits jobs to remote computation infrastructure
4. **Jupyter Interface**: Provides results and status to the DAL UI

### Example Integration Workflow

1. User creates AL project in DVRE Jupyter interface
2. Project gets deployed with AL configuration
3. AL-Engine receives project files and configuration
4. Engine runs AL iterations automatically or on-demand
5. Results are stored and made available to smart contracts
6. UI displays current status and allows user interaction

## API Reference

### ALEngine Class

Main class for managing AL workflows:

```python
from main import ALEngine

# Initialize engine
engine = ALEngine(
    project_id="test-project", 
    config_path="config.json",
    computation_mode="local"
)

# Run single iteration
result = engine.run_iteration(1)

# Run full workflow
results = engine.run_full_workflow()

# Get model performance
performance = engine.get_model_performance()
```

### WorkflowRunner Class

Handles CWL workflow execution:

```python
from workflow_runner import WorkflowRunner

runner = WorkflowRunner()

# Check if cwltool is available
if runner.check_cwltool_available():
    result = runner.run_al_iteration(inputs, work_dir)
else:
    result = runner.run_direct_python(inputs, work_dir)
```

### OrchestratorClient Class

Manages remote execution:

```python
from orchestrator_client import OrchestratorClient

client = OrchestratorClient("http://orchestrator:5004")

# Submit job
job_id = client.submit_al_iteration(project_id, iteration, config_file)

# Wait for completion
result = client.wait_for_completion(job_id)
```

## Development

### Running Tests

```bash
# Install development dependencies
pip install pytest pytest-cov

# Run tests
pytest tests/ --cov=al-engine
```

### Code Formatting

```bash
# Install formatting tools
pip install black flake8

# Format code
black .

# Check style
flake8 .
```

### Extending the Engine

To add new query strategies:

1. Import strategy in `al_iteration.py`
2. Modify model initialization based on configuration
3. Update configuration schema documentation

To add new model types:

1. Extend model selection in `al_iteration.py`
2. Update configuration options
3. Test with existing AL strategies

## Troubleshooting

### Common Issues

**CWL Tool Not Found:**
```bash
# Install cwltool
pip install cwltool

# Or use direct Python execution
# Engine will automatically fallback if cwltool is unavailable
```

**Memory Issues with Large Datasets:**
```bash
# Use smaller batch sizes in configuration
{
  "n_queries": 10,  # Reduce from default 50
  "chunk_size": 1000  # Process data in chunks
}
```

**Remote Orchestrator Connection:**
```bash
# Check orchestrator health
python -c "from orchestrator_client import OrchestratorClient; print(OrchestratorClient().check_orchestrator_health())"
```

### Logging

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

View logs for specific components:

```bash
# View only AL-Engine logs
python main.py --project_id test --config config.json --workflow 2>&1 | grep "AL-Engine"
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the DVRE system. See the main project license for details.

## Support

For issues and questions:

- Create an issue in the main DVRE repository
- Check the troubleshooting section above
- Review logs for detailed error information 