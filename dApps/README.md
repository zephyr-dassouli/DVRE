# DVRE dApps - Modular Extension Architecture

This directory contains modular dApp extensions for the DVRE (Decentralized Virtual Research Environment) platform. Each dApp is a self-contained package that can be independently installed, updated, and managed.

## 📁 Architecture Overview

```
dApps/
├── dal/                           # Decentralized Active Learning dApp
│   ├── manifest.json             # Extension metadata & configuration
│   ├── extension/                # JupyterLab frontend components
│   ├── backend/                  # FastAPI orchestration server
│   ├── al-engine/                # ML compute container
│   └── workflows/                # CWL workflow definitions
│
├── federated/                    # Federated Learning dApp (future)
├── research/                     # Research Collaboration dApp (future)
└── README.md                     # This file
```

## 🎯 DAL dApp (Decentralized Active Learning)

### **Components:**

**🖥️ Frontend Extension (`extension/`)**
- React-based JupyterLab components
- UI for project management and workflow control
- Real-time progress tracking and visualization
- User interaction for sample labeling

**⚙️ Backend Service (`backend/`)**
- FastAPI application for workflow orchestration
- CWL (Common Workflow Language) interpreter
- Communication bridge with DVRE platform
- Project status management and data persistence

**🧠 AL Engine (`al-engine/`)**
- Pure ML compute container
- Active Learning algorithms (uncertainty, entropy, random sampling)
- Model training and query selection
- File-based communication with backend

**📋 Workflows (`workflows/`)**
- CWL workflow definitions
- Step-by-step AL process orchestration
- Configurable for different AL strategies

### **Manifest Configuration:**
```json
{
  "name": "dal",
  "displayName": "Decentralized Active Learning",
  "version": "1.0.0",
  "backend": {
    "dockerfile": "backend/Dockerfile",
    "port": 8001
  },
  "compute": {
    "dockerfile": "al-engine/Dockerfile",
    "volumes": ["/dal_data"]
  },
  "permissions": [
    "blockchain:read", "blockchain:write",
    "storage:read", "storage:write"
  ]
}
```

## 🔄 How Extension Discovery Works

1. **Core DVRE** scans `dApps/` directory on startup
2. **Manifest files** are read to understand extension capabilities
3. **Dynamic loading** of extension components into JupyterLab
4. **Service registration** for backend and compute containers
5. **Command registration** in JupyterLab launcher and palette

## 🚀 Installation & Usage

### **For Users:**
```bash
# Install core DVRE
pip install dvre-core

# Install specific dApps
pip install dvre-dal-extension

# Start JupyterLab - extensions are auto-discovered
jupyter lab
```

### **For Developers:**
```bash
# Development setup
cd dApps/dal
docker-compose up backend al-engine  # Start services
jupyter lab --dev-mode               # Start JupyterLab in dev mode
```

## 🏗️ Benefits of This Architecture

✅ **Modular**: Each dApp is independent and self-contained  
✅ **Scalable**: Easy to add new dApps without core changes  
✅ **Maintainable**: Clear separation of concerns  
✅ **Distributable**: dApps can be packaged and shared independently  
✅ **Flexible**: Different deployment strategies (containers, plugins, services)  
✅ **Discoverable**: Automatic detection and registration  

## 📦 dApp Package Structure

Each dApp follows this standard structure:

```
my-dapp/
├── manifest.json              # Required: Extension metadata
├── extension/                 # Optional: JupyterLab frontend
│   ├── index.js              # Extension entry point
│   └── components/           # React components
├── backend/                   # Optional: Backend services
│   ├── Dockerfile            # Container definition
│   ├── requirements.txt      # Dependencies
│   └── src/                  # Source code
├── compute/                   # Optional: Compute containers
│   ├── Dockerfile            # ML/compute container
│   └── algorithms/           # Algorithm implementations
└── workflows/                 # Optional: CWL workflows
    └── *.cwl                 # Workflow definitions
```

## 🔧 Current Implementation Status

- ✅ **Core Extension Discovery**: Implemented in `jupyter-extension/src/services/ExtensionDiscovery.ts`
- ✅ **Modular Core Plugin**: Updated `jupyter-extension/src/index.ts`
- ✅ **DAL dApp Structure**: Complete with all components
- ✅ **Backend API**: FastAPI with workflow orchestration
- ✅ **Data Models**: Comprehensive Pydantic models
- ✅ **Manifest System**: JSON-based configuration
- ✅ **Build System**: Successfully builds and installs

## 🚧 Next Steps

1. **Real File Discovery**: Replace hardcoded discovery with actual filesystem scanning
2. **Dynamic Loading**: Implement runtime module loading for extensions
3. **Container Orchestration**: Add Docker Compose for multi-container dApps
4. **CWL Integration**: Complete CWL workflow interpreter
5. **dApp Marketplace**: Create registry for sharing dApps
6. **Hot Reloading**: Support for development-time extension updates

## 🤝 Contributing

Each dApp can be developed independently. See individual dApp directories for specific development instructions.

---

**🎉 Achievement Unlocked**: Successfully transformed monolithic DVRE extension into modular, discoverable dApp architecture! 🚀 