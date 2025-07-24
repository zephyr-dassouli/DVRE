# CWL Orchestrator - Technical Capabilities

## Overview

The CWL Orchestrator is a Jupyter-based workflow execution platform designed for coordinating computational workflows in Decentralized Active Learning (DAL) research projects. It serves as the computational engine that executes CWL workflows while the project smart contracts handle governance, consensus, and state management.

## Architecture

```
dApp Frontend 
       ↓
Project Smart Contracts (Consensus, State, Governance)
       ↓
CWL Orchestrator (Jupyter Server - Port 8888)
       ↓
Streamflow Handler Extension
       ↓
├── CWL Workflow Engine
├── AL Workflow Coordinator  
├── dApp Communication Interface
└── Docker Runtime Manager
```

## Separation of Concerns

### **Smart Contracts Handle:**
- ✅ **Consensus Mechanisms**: Voting, agreement thresholds, participant weights
- ✅ **State Management**: Project state, session persistence, voting records
- ✅ **Governance**: Access control, participant roles, project lifecycle
- ✅ **Token Economics**: Incentives, payments, resource allocation
- ✅ **Data Provenance**: IPFS hash tracking, audit trails

### **CWL Orchestrator Handles:**
- ✅ **Workflow Execution**: CWL workflow processing and Docker management
- ✅ **Computation Coordination**: Multi-step pipeline orchestration
- ✅ **dApp Communication**: API endpoints for frontend integration
- ✅ **Resource Management**: Docker containers, compute resources
- ✅ **AL Workflow Logic**: Query strategies, training pipelines

## Core Components

### 1. **Jupyter Server Extension**
- **File**: `src/streamflow_handler.py`
- **Framework**: Tornado-based async handlers
- **XSRF Protection**: Bypassed for API access
- **Port**: 8888 (internal), configurable external mapping

### 2. **CWL Workflow Engine**
- **Standard**: Common Workflow Language (CWL) v1.2
- **Executor**: Docker-based workflow execution
- **Features**: Multi-step pipelines, dependency management, resource isolation

### 3. **AL Workflow Coordinator**
- **Workflow Templates**: Pre-built AL workflows (training, querying, evaluation)
- **dApp Integration**: Receives commands from smart contracts via dApp
- **Status Reporting**: Reports workflow progress back to smart contracts

## API Endpoints

### Core Workflow Management

#### `POST /streamflow/submit`
**Purpose**: Submit basic CWL workflows for execution

**Request Body**:
```json
{
  "cwl_workflow": "#!/usr/bin/env cwl-runner\ncwlVersion: v1.0\nclass: CommandLineTool\nbaseCommand: echo",
  "inputs": {
    "message": "Hello World"
  }
}
```

**Response**:
```json
{
  "workflow_id": "uuid-1234-5678-9abc",
  "status": "SUBMITTED"
}
```

**Example**:
```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "cwl_workflow": "#!/usr/bin/env cwl-runner\ncwlVersion: v1.0\nclass: CommandLineTool\nbaseCommand: echo\ninputs:\n  message:\n    type: string\n    inputBinding:\n      position: 1\noutputs:\n  result:\n    type: stdout",
    "inputs": {"message": "CWL Test"}
  }' \
  http://localhost:5004/streamflow/submit
```

#### `POST /streamflow/submit-project-workflow`
**Purpose**: Submit project-specific CWL workflows triggered by smart contract events

**Request Body**:
```json
{
  "project_id": "medical-imaging-dal",
  "cwl_content": "cwlVersion: v1.2\nclass: Workflow\n...",
  "inputs": {
    "dataset_hash": "QmABC123...",
    "model_config": {...}
  },
  "contract_address": "0x1234567890abcdef...",
  "transaction_hash": "0xabcdef1234567890..."
}
```

**Use Cases**:
- Model training workflows triggered by smart contract
- Data preprocessing pipelines for AL projects
- Evaluation workflows after consensus is reached
- Result aggregation and IPFS storage

#### `GET /streamflow/status/<workflow_id>`
**Purpose**: Monitor workflow execution status (used by dApp to update smart contract)

**Response**:
```json
{
  "workflow_id": "uuid-1234-5678-9abc",
  "status": "RUNNING",
  "progress": 0.65,
  "current_step": "data_preprocessing",
  "output": null,
  "error": null,
  "contract_address": "0x1234567890abcdef...",
  "estimated_completion": "2025-07-22T12:30:00Z"
}
```

**Status Values**: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`

#### `GET /streamflow/workflows`
**Purpose**: List all submitted workflows

**Response**:
```json
{
  "workflows": [
    {
      "workflow_id": "uuid-1234-5678-9abc",
      "status": "COMPLETED",
      "submitted_at": "2025-07-22T10:30:00Z",
      "project_id": "medical-imaging-dal",
      "contract_address": "0x1234567890abcdef..."
    }
  ]
}
```

#### `GET /streamflow/projects/<project_id>/workflows`
**Purpose**: List workflows for a specific project (filtered by smart contract)

**Example**:
```bash
curl http://localhost:5004/streamflow/projects/medical-imaging-dal/workflows
```

### Active Learning Workflow Coordination

#### `POST /al-engine/command`
**Purpose**: Execute AL workflows based on smart contract decisions

**Request Body**:
```json
{
  "project_id": "medical-imaging-dal",
  "command": "start_querying",
  "parameters": {
    "model_hash": "QmXYZ789...",
    "query_strategy": "uncertainty_sampling",
    "batch_size": 10,
    "diversity_threshold": 0.8
  },
  "contract_address": "0x1234567890abcdef...",
  "authorized_by": "0xparticipant_address..."
}
```

**Supported Commands**:

##### `start_querying`
Execute query selection workflow (consensus on strategy handled by smart contract)
```json
{
  "project_id": "medical-imaging-dal",
  "command": "start_querying", 
  "parameters": {
    "model_hash": "QmModelHash123",
    "query_strategy": "uncertainty_sampling",
    "batch_size": 20,
    "confidence_threshold": 0.7
  }
}
```

##### `continue_querying`
Continue AL with updated model (after smart contract validates new model)
```json
{
  "project_id": "medical-imaging-dal",
  "command": "continue_querying",
  "parameters": {
    "updated_model_hash": "QmUpdatedModel456",
    "previous_session_id": "session-789"
  }
}
```

##### `prompt_training`
Execute training workflow (triggered after consensus on labels)
```json
{
  "project_id": "medical-imaging-dal", 
  "command": "prompt_training",
  "parameters": {
    "training_data_hash": "QmTrainingData789",
    "hyperparameters": {
      "learning_rate": 0.001,
      "epochs": 50,
      "batch_size": 32
    }
  }
}
```

##### `evaluate_model`
Run model evaluation workflow (after training completion)
```json
{
  "project_id": "medical-imaging-dal",
  "command": "evaluate_model",
  "parameters": {
    "model_hash": "QmNewModel123",
    "test_data_hash": "QmTestData456",
    "metrics": ["accuracy", "precision", "recall", "f1"]
  }
}
```

##### `finalize_results`
Aggregate and store final results (after project termination consensus)
```json
{
  "project_id": "medical-imaging-dal",
  "command": "finalize_results",
  "parameters": {
    "final_model_hash": "QmFinalModel999",
    "performance_metrics": {...},
    "participant_contributions": {...}
  }
}
```

#### `GET /al-engine/sessions/<project_id>`
**Purpose**: Get workflow session status for smart contract state updates

**Response**:
```json
{
  "project_id": "medical-imaging-dal",
  "sessions": [
    {
      "session_id": "session-123",
      "status": "active",
      "created_at": "2025-07-22T09:00:00Z",
      "last_activity": "2025-07-22T11:30:00Z",
      "workflows_executed": 15,
      "current_workflow": "training-phase-3"
    }
  ]
}
```

## Technical Capabilities

### 1. **CWL Workflow Execution**

#### Docker-based Processing
```yaml
# Example: Model Training Workflow
cwlVersion: v1.2
class: Workflow
inputs:
  training_data: File
  model_config: File
  hyperparameters: File
steps:
  prepare_data:
    run:
      class: CommandLineTool
      baseCommand: ["python", "preprocess.py"]
      inputs:
        data: File
      outputs:
        processed_data: File
  train_model:
    run:
      class: CommandLineTool
      baseCommand: ["python", "train.py"]
      inputs:
        data: File
        config: File
        params: File
      outputs:
        trained_model: File
        metrics: File
  store_results:
    run:
      class: CommandLineTool
      baseCommand: ["ipfs", "add"]
      inputs:
        model: File
        metrics: File
      outputs:
        model_hash: string
        metrics_hash: string
```

#### Multi-step Pipelines
- **Dependency Management**: Automatic step ordering based on data flow
- **Resource Isolation**: Each step runs in separate Docker containers
- **Error Propagation**: Failed steps trigger smart contract notifications
- **Progress Tracking**: Real-time status updates to dApp/smart contracts

#### Network Operations
```yaml
requirements:
  NetworkAccess:
    networkAccess: true
  DockerRequirement:
    dockerPull: "tensorflow/tensorflow:latest-gpu"
```

### 2. **Active Learning Workflow Templates**

#### Pre-built AL Workflows
- **Query Selection**: Uncertainty, diversity, committee-based sampling
- **Model Training**: Supervised learning with incremental updates
- **Model Evaluation**: Performance metrics and validation
- **Data Augmentation**: Synthetic data generation workflows
- **Ensemble Training**: Multi-model coordination

#### Smart Contract Integration
```bash
# Example: Training workflow triggered by smart contract
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "medical-imaging-dal",
    "command": "prompt_training",
    "parameters": {
      "training_data_hash": "QmTrainingData789",
      "consensus_labels_hash": "QmConsensusLabels456"
    },
    "contract_address": "0x1234567890abcdef...",
    "transaction_hash": "0xabcdef1234567890..."
  }' \
  http://localhost:5004/al-engine/command
```

### 3. **Integration Capabilities**

#### IPFS Integration
```bash
# Example: Store model results on IPFS
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "cwl_workflow": "ipfs-storage-workflow",
    "inputs": {
      "model_file": "/tmp/trained_model.pkl",
      "metadata": {"accuracy": 0.92, "epoch": 100},
      "contract_address": "0x1234567890abcdef..."
    }
  }' \
  http://localhost:5004/streamflow/submit
```

#### Docker Ecosystem
- **Container Management**: Automatic lifecycle management
- **GPU Support**: CUDA-enabled containers for ML training
- **Resource Limits**: CPU/memory/GPU constraints
- **Network Isolation**: Secure inter-container communication

#### Smart Contract Communication
```json
{
  "workflow_completion": {
    "project_id": "medical-imaging-dal",
    "workflow_id": "uuid-1234-5678-9abc",
    "status": "COMPLETED",
    "results": {
      "model_hash": "QmNewModel123",
      "accuracy": 0.94,
      "training_time": "45 minutes"
    },
    "contract_callback": "0x1234567890abcdef..."
  }
}
```

## Real-World Use Cases

### 1. **Medical Image Classification**

**Smart Contract Handles**: Participant consensus on query strategy, label validation, payment distribution  
**CWL Orchestrator Handles**: Image preprocessing, model training, evaluation workflows

```bash
# 1. Smart contract triggers preprocessing workflow
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "pneumonia-detection",
    "cwl_content": "# CWL for DICOM preprocessing",
    "inputs": {
      "dicom_dataset": "QmMedicalImages123",
      "normalization": "z_score",
      "resize_dims": [224, 224]
    },
    "contract_address": "0xMedicalDALContract..."
  }' \
  http://localhost:5004/streamflow/submit-project-workflow

# 2. After consensus on query strategy, execute querying
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "pneumonia-detection",
    "command": "start_querying",
    "parameters": {
      "model_hash": "QmResNet50Pretrained",
      "query_strategy": "uncertainty_sampling",
      "batch_size": 20
    },
    "contract_address": "0xMedicalDALContract..."
  }' \
  http://localhost:5004/al-engine/command

# 3. After label consensus, trigger training
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "pneumonia-detection",
    "command": "prompt_training",
    "parameters": {
      "training_data_hash": "QmTrainingData789",
      "consensus_labels_hash": "QmConsensusLabels456"
    },
    "contract_address": "0xMedicalDALContract..."
  }' \
  http://localhost:5004/al-engine/command
```

### 2. **Legal Document Classification**

**Smart Contract Handles**: Expert agreement thresholds, dispute resolution, quality scoring  
**CWL Orchestrator Handles**: NLP preprocessing, BERT fine-tuning, document classification

```bash
# 1. Execute NLP preprocessing workflow
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "contract-analysis",
    "cwl_content": "# CWL for legal document NLP",
    "inputs": {
      "document_corpus": "QmLegalDocs456",
      "preprocessing": ["tokenization", "entity_extraction"]
    },
    "contract_address": "0xLegalDALContract..."
  }' \
  http://localhost:5004/streamflow/submit-project-workflow

# 2. Execute diversity-based querying (after smart contract consensus)
curl -X POST -H 'Content-Type: application/json' \
  -d '{
    "project_id": "contract-analysis", 
    "command": "start_querying",
    "parameters": {
      "model_hash": "QmBERTLegal789",
      "query_strategy": "diversity_sampling",
      "batch_size": 15
    },
    "contract_address": "0xLegalDALContract..."
  }' \
  http://localhost:5004/al-engine/command
```

## Current Limitations

### ❌ **Not Yet Implemented**
1. **Real Smart Contract Integration**: Currently simulated contract communication
2. **GPU Resource Management**: Advanced GPU scheduling and allocation
3. **Workflow Caching**: Intermediate result caching for efficiency
4. **Advanced Monitoring**: Real-time resource usage monitoring
5. **Workflow Templates**: Pre-built AL workflow library

### ⚠️ **Development Mode Features**
- **Simulated Contract Calls**: Mock smart contract integration
- **Basic Resource Limits**: Simple CPU/memory constraints
- **In-memory Caching**: Limited workflow result caching

## Deployment & Testing

### **Production Deployment**
```bash
# Deploy CWL orchestrator
./deploy.sh --port 5004

# Verify deployment
curl http://localhost:5004/tree
curl http://localhost:5004/streamflow/workflows
```

### **Testing Suite**
```bash
# Run comprehensive test suite
./test_orchestration_server.sh

# Tests include:
# - CWL workflow execution
# - AL workflow coordination
# - dApp communication endpoints
# - Docker container management
# - Error handling and recovery
```

### **Health Monitoring**
```bash
# Check orchestrator health
./health_check.sh

# Manual health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:5004/tree
```

## Future Roadmap

### **Phase 3: Smart Contract Integration**
- [ ] Real smart contract communication via Web3
- [ ] Event-driven workflow triggering
- [ ] On-chain workflow status updates
- [ ] Gas-optimized contract interactions

### **Phase 4: Advanced Orchestration**
- [ ] GPU cluster management
- [ ] Workflow template library
- [ ] Advanced caching strategies
- [ ] Cross-institutional workflow sharing
- [ ] Federated learning coordination

## Technical Specifications

- **Framework**: Jupyter Server + Tornado
- **Language**: Python 3.8+
- **Container Runtime**: Docker + Docker Compose
- **Workflow Standard**: CWL v1.2
- **API Format**: REST JSON
- **Deployment**: Docker containerized
- **Port**: 8888 (internal), configurable external
- **Dependencies**: See `requirements.txt`

---

**Last Updated**: July 2025  
**Version**: 1.0.0  
**Maintainer**: DVRE Development Team 