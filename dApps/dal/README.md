# DVRE DAL Extension

Decentralized Active Learning (DAL) extension for the DVRE (Decentralized Virtual Research Environment) platform.

## Overview

The DAL extension provides active learning capabilities within JupyterLab, allowing researchers to:

- Implement uncertainty sampling strategies
- Perform entropy-based sample selection
- Execute federated active learning workflows
- Integrate with blockchain-based research data management

## Features

- **Active Learning Strategies**: Multiple sampling strategies including uncertainty sampling, entropy sampling, and random sampling
- **Decentralized Architecture**: Works with DVRE's blockchain-based infrastructure
- **CWL Integration**: Common Workflow Language orchestrated backend for reproducible workflows
- **Modular Design**: Standalone JupyterLab extension that integrates with the main DVRE platform

## Installation

### Prerequisites

- Python 3.9+
- JupyterLab 4.0+
- Node.js 16+ (for development)
- DVRE Core extension

### Install from PyPI

```bash
pip install jupyter-dvre-dal
```

### Development Installation

```bash
# Clone and navigate to the DAL extension
cd dApps/dal

# Create virtual environment
python3 -m venv venv-dal
source venv-dal/bin/activate

# Install in development mode
pip install -e "."

# Link with JupyterLab
jupyter labextension develop . --overwrite

# Build the extension
jlpm build
```

## Usage

1. Start JupyterLab: `jupyter lab`
2. Look for "Active Learning" in the Launcher or Command Palette
3. Configure your active learning workflow
4. Execute sampling strategies and model training

## Architecture

- **Frontend**: React-based JupyterLab extension
- **Backend**: CWL-orchestrated workflows
- **Compute Engine**: Docker-based AL engine
- **Storage**: IPFS and blockchain integration

## Development

### Build Commands

```bash
# Build for development
jlpm build

# Build for production
jlpm build:prod

# Watch for changes
jlpm watch
```

### Project Structure

```
dApps/dal/
├── src/                 # TypeScript source
├── style/               # CSS styles
├── jupyter_dvre_dal/    # Python package
├── backend/             # Backend services
├── al-engine/           # Active learning algorithms
└── manifest.json        # Extension metadata
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions, please open an issue on the GitHub repository. 