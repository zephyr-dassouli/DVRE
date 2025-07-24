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
pip install -e .

# Link with JupyterLab for development (skip build for now)
jupyter labextension develop . --overwrite

# Alternative: Manual npm build (if jlpm fails)
cd jupyter-extension
npm install
npm run build
pip install -e .
jupyter labextension install .

# Verify installation
jupyter labextension list | grep jupyter-dvre
```

### DAL Extension Setup (Two-Phase Active Learning)

**✅ Working Method (Use this approach):**

```bash
cd dApps/dal

# Create separate virtual environment
python3 -m venv venv-dal
source venv-dal/bin/activate

# Clean any previous builds
rm -rf lib/ jupyter_dvre_dal/labextension/ node_modules/.cache/ node_modules/

# Install Node.js dependencies with npm (more reliable than yarn)
npm install

# Build TypeScript and extension step by step
npm run build:lib:prod
npm run build:labextension

# Install Python package in development mode
pip install -e .

# Enable the extension (JupyterLab 4.x)
jupyter labextension enable jupyter-dvre-dal

# Clean JupyterLab cache and rebuild
jupyter lab clean --all
jupyter lab build

# Verify installation
jupyter labextension list | grep dal
```

**🔧 Alternative: Use the automated script:**

```bash
cd dApps/dal
./quick-fix.sh
```

### Start Complete DVRE System

```bash
# Option 1: Start with orchestration server
cd orchestration-server
source venv/bin/activate
jupyter server --ip=0.0.0.0 --port=8888 --no-browser

# Option 2: Start standard JupyterLab (both extensions will auto-load)
# Make sure both extensions are installed first
jupyter lab

# Check extensions are loaded in browser console:
# "DVRE Core: Discovered X dApp extension(s)"
# "DAL Extension: Two-Phase AL orchestration loaded"
```

### Troubleshooting DAL Extension Loading

If the DAL extension doesn't load consistently:

```bash
cd dApps/dal

# Clean and rebuild everything
yarn clean:all
yarn install
yarn build:prod

# Reinstall Python package
pip uninstall jupyter-dvre-dal -y
pip install -e .

# Force refresh JupyterLab
jupyter lab clean
jupyter lab build

# Restart JupyterLab
jupyter lab --ip=0.0.0.0 --port=8888
```

### Verification

1. **Check Extension Status:**
   ```bash
   jupyter labextension list
   # Should show: jupyter-dvre-dal (enabled, ok)
   ```

2. **Browser Console Logs:**
   - Open JupyterLab
   - Check browser console for extension loading messages
   - Look for DAL-specific logs and components

3. **Test Two-Phase Workflow:**
   - Phase 1: Configure CWL workflows in DAL extension
   - Phase 2: Use Runtime Orchestration panel for AL sessions