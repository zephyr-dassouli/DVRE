# StreamFlow Integration with DVRE Orchestration Server

## Overview

The DVRE orchestration server has been upgraded to use **real StreamFlow** (`workflows.community/systems/streamflow/`) as the workflow execution engine, replacing the previous mock implementation.

## 🎯 **What Changed**

### **Before (Mock Implementation):**
```python
# Old mock execution
command = ["echo", f"Executing workflow {workflow_id}..."]
proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
```

### **After (Real StreamFlow):**
```python
# Real StreamFlow execution
result = await streamflow_executor.submit_workflow(
    workflow_id=workflow_id,
    cwl_content=cwl_content,
    inputs=workflow["inputs"],
    deployment=workflow.get("deployment", "local"),
    metadata={"debug": True, "source": "basic_submission"}
)
```

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                DVRE Orchestration Server                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Tornado API     │    │     StreamFlow Integration     │ │
│  │ Handlers        │◄──►│                                 │ │
│  │                 │    │ • StreamFlowExecutor           │ │
│  │ • Submit        │    │ • StreamFlowConfig             │ │
│  │ • Status        │    │ • Real CWL execution           │ │
│  │ • DAL Templates │    │ • Multi-deployment support     │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     StreamFlow Engine                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Local     │  │   Docker    │  │    Singularity     │ │
│  │ Deployment  │  │ Deployment  │  │    Deployment      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     CWL Workflows                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Standard    │  │ DAL Active  │  │   Custom User       │ │
│  │ Workflows   │  │ Learning    │  │   Workflows         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 **New Files Added**

1. **`src/streamflow_config.py`** - StreamFlow integration module
2. **`streamflow.yml`** - StreamFlow configuration file
3. **`test_streamflow_integration.sh`** - Integration test script

## 🔧 **Updated Files**

1. **`requirements.txt`** - Added `streamflow==0.1.6`
2. **`src/workflow_handlers.py`** - Updated to use real StreamFlow
3. **`src/dal_templates.py`** - Enhanced DAL template info with StreamFlow

## 🚀 **Supported Deployments**

### **1. Local Deployment**
```yaml
local:
  type: local
  config:
    workdir: /tmp/streamflow/dvre-local
```

### **2. Docker Deployment**
```yaml
docker:
  type: docker
  config:
    image: python:3.9-slim
    hostname: dvre-docker-worker
    workdir: /tmp/streamflow/dvre-docker
    env:
      DVRE_ENV: docker
      PYTHONPATH: /opt/dvre
```

### **3. Singularity Deployment**
```yaml
singularity:
  type: singularity
  config:
    image: docker://python:3.9-slim
    hostname: dvre-singularity-worker
    workdir: /tmp/streamflow/dvre-singularity
```

## 🎯 **API Changes**

### **New Deployment Parameter**
Both workflow submission endpoints now support a `deployment` parameter:

```json
{
  "cwl_workflow": {...},
  "inputs": {...},
  "deployment": "docker"  // ← New parameter: local, docker, singularity
}
```

### **Enhanced Responses**
All responses now include execution engine information:

```json
{
  "workflow_id": "uuid",
  "status": "SUBMITTED",
  "execution_engine": "streamflow",  // ← New field
  "deployment": "docker"             // ← New field
}
```

## 🧪 **Testing the Integration**

### **Run the Test Script**
```bash
chmod +x test_streamflow_integration.sh
./test_streamflow_integration.sh
```

### **Manual Testing**

1. **Basic Workflow Submission:**
```bash
curl -X POST http://localhost:8888/streamflow/submit \
  -H "Content-Type: application/json" \
  -H "X-User-Wallet: 0x123..." \
  -H "X-User-Role: coordinator" \
  -d '{
    "cwl_workflow": {
      "cwlVersion": "v1.0",
      "class": "CommandLineTool",
      "baseCommand": "echo",
      "inputs": {"message": {"type": "string", "inputBinding": {"position": 1}}},
      "outputs": {"output": {"type": "stdout"}}
    },
    "inputs": {"message": "Hello StreamFlow!"},
    "deployment": "local"
  }'
```

2. **DAL Workflow Submission:**
```bash
curl -X POST http://localhost:8888/streamflow/submit-project-workflow \
  -H "Content-Type: application/json" \
  -H "X-User-Wallet: 0x123..." \
  -H "X-User-Role: coordinator" \
  -d '{
    "project_id": "test-project",
    "use_dal_template": true,
    "dal_workflow_type": "train_query",
    "deployment": "docker",
    "metadata": {
      "al_config": {
        "query_strategy": "uncertainty_sampling",
        "query_budget": 10
      }
    }
  }'
```

## 🔄 **Fallback Mechanism**

If StreamFlow is not available, the system automatically falls back to `cwltool`:

```python
# Automatic fallback
if not await self._check_streamflow_available():
    return await self._fallback_execution(workflow_id, config_file, inputs_file, metadata)
```

## 📊 **Benefits of StreamFlow Integration**

1. **🔧 Real Workflow Execution** - No more mock implementations
2. **🌐 Multi-Cloud Support** - Deploy to local, Docker, Singularity, HPC
3. **📈 Production Ready** - Battle-tested workflow management system
4. **🔄 CWL Compliance** - Full Common Workflow Language support
5. **📦 Container Native** - First-class container support
6. **🎯 Hybrid Workflows** - Multi-cloud and hybrid cloud/HPC infrastructure

## 🛠️ **Configuration**

### **Environment Variables**
- `STREAMFLOW_CONFIG` - Path to custom StreamFlow configuration file

### **StreamFlow Configuration File**
The `streamflow.yml` file can be customized for your deployment needs. See the file for examples of:
- Local execution
- Docker containers
- Singularity containers
- HPC/SLURM clusters (commented examples)

## 🎉 **Next Steps**

1. **Install StreamFlow:** `pip install streamflow==0.1.6`
2. **Deploy the updated server:** `./deploy.sh`
3. **Test the integration:** `./test_streamflow_integration.sh`
4. **Submit real workflows** with multi-deployment support

## 📚 **References**

- [StreamFlow Documentation](https://streamflow.di.unito.it/)
- [StreamFlow GitHub](https://github.com/alpha-unito/streamflow)
- [Workflows Community](https://workflows.community/systems/streamflow/)
- [Common Workflow Language](https://www.commonwl.org/)

---

**🎯 Your DVRE orchestration server is now powered by real StreamFlow!** 🚀 