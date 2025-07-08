# D-VRE (Decentralized Virtual Research Environment)

A blockchain-based platform for managing decentralized research projects.


## Architecture

### Core Components

1. **Smart Contracts** (`/contracts/`)
   - Project management and governance
   - User metadata and authentication
   - Factory patterns for scalable deployment

2. **JupyterLab Extension** (`/jupyter-extension/`)
   - Interactive project widgets
   - Graph visualization of project networks
   - Federated learning project management
   - Web3 integration for blockchain connectivity

3. **Deployment Scripts** (`/scripts/`)
   - Automated contract deployment
   - Registry management utilities

## Installation

### Prerequisites
- Node.js (v16+)
- Python (3.8+)
- JupyterLab (3.0+)
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

### JupyterLab Extension Setup

```bash
cd jupyter-extension

# Install dependencies
jlpm install

# Build the extension
jlpm run build

# Start the extension
jupyter lab
```
