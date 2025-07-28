// Configuration for D-VRE Extension
export const config = {
  // IPFS Configuration
  ipfs: {
    baseUrl: 'http://dvre03.lab.uvalight.net:5002/api/v0',
    publicUrl: 'http://dvre03.lab.uvalight.net:8081/ipfs',
    apiKey: 'dvre-platform-master-key',
    healthUrl: 'http://dvre03.lab.uvalight.net:5002/health'
  },
  
  // Orchestrator Configuration
  orchestrator: {
    endpoint: 'http://145.100.135.97:5004/streamflow/submit-project-workflow',
    baseUrl: 'http://145.100.135.97:5004',
    timeout: 30000
  },
  
  // Blockchain Configuration
  blockchain: {
    // Set this to the deployed AssetFactory contract address
    assetFactoryAddress: process.env.ASSET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
    
    // Network configuration
    networks: {
      localhost: {
        chainId: 31337,
        rpcUrl: 'http://localhost:8545'
      },
      hardhat: {
        chainId: 31337,
        rpcUrl: 'http://localhost:8545'
      }
    }
  },
  
  // File type mappings for better UX
  fileTypes: {
    dataset: {
      extensions: ['.csv', '.json', '.xlsx', '.parquet', '.h5'],
      color: '#4caf50'
    },
    model: {
      extensions: ['.pkl', '.h5', '.pt', '.pth', '.onnx', '.joblib'],
      color: '#2196f3'
    },
    script: {
      extensions: ['.py', '.js', '.ts', '.r', '.ipynb'],
      color: '#ff9800'
    },
    document: {
      extensions: ['.pdf', '.doc', '.docx', '.txt', '.md'],
      color: '#9c27b0'
    }
  }
};

export default config;
