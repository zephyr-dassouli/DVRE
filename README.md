# D-VRE (Decentralized Virtual Research Environment)

A blockchain-based platform for managing decentralized research projects with Two-Phase Active Learning orchestration.

## Architecture

### Core Components

1. **Smart Contracts** (`/contracts/`)
   - Project management and governance
   - User metadata and authentication
   - Factory patterns for scalable deployment

2. **JupyterLab Extensions**
   - **Core Extension** (`/jupyter-extension/`) - Main DVRE functionality
   - **DAL Extension** (`/dApps/dal/`) - Decentralized Active Learning with Two-Phase orchestration
   - **Orchestration Server** (`/orchestration-server/`) - Backend AL-engine communication

3. **Deployment Scripts** (`/scripts/`)
   - Automated contract deployment
   - Registry management utilities

## Installation

### Prerequisites
- Node.js (v16+)
- Python (3.9+)
- JupyterLab (4.0+)
- Yarn (v3.5.0+)
- Hardhat for smart contract development

### Smart Contracts Setup

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Deploy to local network
node scripts/deploy-web3.js
```

### DVRE Orchestration Server Setup

```bash
cd orchestration-server

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install in development mode
pip install -e .

# Start Jupyter server with orchestration extension
jupyter server --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

### DVRE Core JupyterLab Extension Setup

** Working Method (Use this approach):**

```bash
cd jupyter-extension

# Create virtual environment (if not already exists)
python3 -m venv venv
source venv/bin/activate

# Install in development mode
yarn build & pip install -e .


# CACHING ISSUE FULL CLEAN
# From the jupyter-extension directory

# 1. Manual Clean
npx rimraf lib tsconfig.tsbuildinfo
npx rimraf jupyter_dvre/labextension jupyter_dvre/_version.py
jupyter lab clean --all

# 2. Fresh Dependencies
rm -rf node_modules yarn.lock
yarn install

# 3. Manual Build
npx tsc --sourceMap
jupyter labextension build .

# 4. Re-install
pip install -e .

# 5. Rebuild Core (if needed after cleaning)
jupyter lab build

# 6. Run
jupyter lab