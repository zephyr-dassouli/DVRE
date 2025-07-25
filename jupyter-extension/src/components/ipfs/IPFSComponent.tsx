import React, { useState, useEffect } from 'react';
import { ipfsService, IPFSFile } from '../../utils/IPFSService';
import { assetService, AssetInfo } from '../../utils/AssetService';

interface IPFSComponentProps {
  title?: string;
}

export const IPFSComponent: React.FC<IPFSComponentProps> = ({ 
  title = 'IPFS Manager' 
}) => {
  const [files, setFiles] = useState<IPFSFile[]>([]);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('dataset');
  const [userAccount, setUserAccount] = useState<string | null>(null);
  const [ipfsHealthy, setIpfsHealthy] = useState<boolean | null>(null);
  const [blockchainAvailable, setBlockchainAvailable] = useState<boolean>(false);

  useEffect(() => {
    checkIPFSHealth();
    loadFiles();
    checkBlockchainAvailability(); // This will also try to load assets
  }, []);

  const checkBlockchainAvailability = async () => {
    const hasMetaMask = typeof window !== 'undefined' && (window as any).ethereum;
    const isConfigured = assetService.isConfigured();
    setBlockchainAvailable(hasMetaMask && isConfigured);
    
    // If blockchain is available, try to load assets immediately
    if (hasMetaMask && isConfigured) {
      try {
        const assetList = await assetService.getAllAssets();
        setAssets(assetList);
        console.log('Blockchain assets loaded:', assetList.length);
      } catch (error) {
        console.warn('Failed to load blockchain assets on startup:', error);
      }
    }
  };

  const checkIPFSHealth = async () => {
    try {
      const healthy = await ipfsService.healthCheck();
      setIpfsHealthy(healthy);
    } catch (error) {
      setIpfsHealthy(false);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const fileList = await ipfsService.listFiles();
      setFiles(fileList);
    } catch (error) {
      console.error('Failed to load files:', error);
      setError(`Failed to load file list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      const assetList = await assetService.getAllAssets();
      setAssets(assetList);
    } catch (error) {
      console.warn('Failed to load assets (blockchain may not be available):', error);
      // Don't set error for this, as blockchain is optional
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Upload to IPFS first
      const uploadResult = await ipfsService.uploadFile(selectedFile);
      
      // If blockchain is available and asset name is provided, create blockchain asset
      if (blockchainAvailable && assetName.trim()) {
        try {
          if (!userAccount) {
            // Try to connect wallet first
            const account = await assetService.connectWallet();
            setUserAccount(account);
          }
          
          await assetService.createAsset(assetName, assetType, uploadResult.Hash);
          await loadAssets();
          alert(`Asset "${assetName}" created successfully on blockchain! IPFS Hash: ${uploadResult.Hash}`);
        } catch (error) {
          console.log('Failed to create blockchain asset, but IPFS upload succeeded:', error);
          alert(`File uploaded to IPFS successfully, but blockchain registration failed: ${error instanceof Error ? error.message : 'Unknown error'}\nIPFS Hash: ${uploadResult.Hash}`);
        }
      } else if (blockchainAvailable && !assetName.trim()) {
        alert(`File uploaded to IPFS successfully! IPFS Hash: ${uploadResult.Hash}\n\nTip: Provide an asset name to register it on the blockchain.`);
      } else {
        alert(`File uploaded to IPFS successfully! IPFS Hash: ${uploadResult.Hash}`);
      }

      // Refresh file list (fallback)
      await loadFiles();
      
      // Reset form
      setSelectedFile(null);
      setAssetName('');
      
    } catch (error) {
      console.error('Upload failed:', error);
      setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (hash: string) => {
    try {
      setLoading(true);
      const blob = await ipfsService.downloadFile(hash);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipfs-${hash}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      setError(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      const account = await assetService.connectWallet();
      setUserAccount(account);
      await loadAssets();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getPublicUrl = (hash: string) => {
    return ipfsService.getPublicUrl(hash);
  };

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <h1 style={{ 
        fontSize: '2em',
        margin: '20px 0',
        color: 'var(--jp-ui-font-color1)',
        textAlign: 'center'
      }}>
        {title}
      </h1>

      {/* Health Status */}
      <div style={{ marginBottom: '20px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px',
          backgroundColor: ipfsHealthy ? '#4caf50' : '#f44336',
          color: 'white',
          fontSize: '12px'
        }}>
          IPFS: {ipfsHealthy ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px',
          backgroundColor: blockchainAvailable ? '#4caf50' : '#f44336',
          color: 'white',
          fontSize: '12px'
        }}>
          Blockchain: {blockchainAvailable ? 'Connected' : 'Not Available'}
        </span>
      </div>

      {error && (
        <div style={{ 
          color: '#f44336', 
          background: '#ffebee',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Upload Section */}
      <div style={{ 
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        background: 'var(--jp-layout-color0)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)' }}>
          Upload File
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <input 
            type="file" 
            onChange={handleFileSelect}
            style={{ marginBottom: '10px', width: '100%' }}
          />
        </div>

        {/* Asset metadata (required for blockchain) */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', color: 'var(--jp-ui-font-color1)' }}>
            {blockchainAvailable ? 'Asset Details (Blockchain Registration)' : 'Asset Details (Optional)'}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={blockchainAvailable ? "Asset name (required for blockchain)" : "Asset name (optional)"}
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              style={{ 
                padding: '8px',
                border: `2px solid ${blockchainAvailable && !assetName ? '#f44336' : 'var(--jp-border-color1)'}`,
                borderRadius: '4px',
                flex: '1',
                minWidth: '200px',
                backgroundColor: blockchainAvailable ? 'var(--jp-layout-color0)' : 'var(--jp-layout-color1)'
              }}
            />
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              style={{ 
                padding: '8px',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '4px',
                backgroundColor: blockchainAvailable ? 'var(--jp-layout-color0)' : 'var(--jp-layout-color1)'
              }}
            >
              <option value="dataset">Dataset</option>
              <option value="model">Model</option>
              <option value="script">Script</option>
              <option value="document">Document</option>
              <option value="other">Other</option>
            </select>
          </div>
          {blockchainAvailable && (
            <div style={{ 
              marginTop: '5px',
              fontSize: '12px',
              color: 'var(--jp-brand-color1)',
              fontStyle: 'italic'
            }}>
              Asset name is required to register on the blockchain. Leave empty for IPFS-only storage.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedFile && !loading ? 'var(--jp-brand-color1)' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFile && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Uploading...' : blockchainAvailable ? 'Upload & Register Asset' : 'Upload to IPFS'}
          </button>

          {blockchainAvailable && !userAccount && (
            <button
              onClick={connectWallet}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--jp-warn-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Connect Wallet
            </button>
          )}

          {blockchainAvailable && userAccount && (
            <div style={{ 
              padding: '8px 12px',
              backgroundColor: 'var(--jp-brand-color1)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              Connected: {userAccount.substring(0, 6)}...{userAccount.substring(38)}
            </div>
          )}
        </div>

        {!blockchainAvailable && (
          <div style={{ 
            marginTop: '10px',
            padding: '10px',
            backgroundColor: 'var(--jp-layout-color2)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--jp-ui-font-color2)',
            border: '1px solid var(--jp-border-color2)'
          }}>
            ⚠️ Blockchain not available: Install MetaMask and ensure contracts are deployed to enable asset registration.
          </div>
        )}
      </div>

      {/* Blockchain Assets (Primary) */}
      {blockchainAvailable && (
        <div style={{ 
          border: '2px solid var(--jp-brand-color1)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          background: 'var(--jp-layout-color0)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Blockchain Assets ({assets.length})
            <button
              onClick={loadAssets}
              disabled={loading}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--jp-brand-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </h3>
          
          {assets.length === 0 ? (
            <div style={{ 
              padding: '20px',
              textAlign: 'center',
              color: 'var(--jp-ui-font-color2)',
              background: 'var(--jp-layout-color2)',
              borderRadius: '4px'
            }}>
              <p>No blockchain assets found.</p>
              <p style={{ fontSize: '14px', margin: '10px 0' }}>
                Upload a file with an asset name to create your first blockchain asset.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {assets.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    padding: '15px',
                    border: '1px solid var(--jp-border-color2)',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    background: 'var(--jp-layout-color1)'
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ color: 'var(--jp-ui-font-color1)' }}>
                      {asset.name}
                    </strong>
                    <span style={{ 
                      marginLeft: '10px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--jp-brand-color1)',
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}>
                      {asset.assetType}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--jp-ui-font-color2)',
                    wordBreak: 'break-all',
                    marginBottom: '8px'
                  }}>
                    IPFS: {asset.ipfsHash}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleDownload(asset.ipfsHash)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--jp-brand-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => window.open(getPublicUrl(asset.ipfsHash), '_blank')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--jp-accept-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IPFS Files (Fallback/Additional) */}
      <div style={{ 
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        background: 'var(--jp-layout-color0)',
        opacity: blockchainAvailable ? 0.7 : 1
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)' }}>
          Raw IPFS Files ({files.length}) {blockchainAvailable && '(Unregistered)'}
        </h3>
        
        <button
          onClick={loadFiles}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        {files.length === 0 && !loading && !error ? (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: 'var(--jp-ui-font-color2)',
            background: 'var(--jp-layout-color2)',
            borderRadius: '4px'
          }}>
            <p style={{ marginBottom: '10px' }}>No files found or IPFS not accessible.</p>
            <p style={{ fontSize: '14px', margin: '10px 0' }}>
              If you have IPFS hashes, you can still access files directly:
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Enter IPFS hash (QmXXXXXX...)"
                style={{ 
                  padding: '8px',
                  border: '1px solid var(--jp-border-color1)',
                  borderRadius: '4px',
                  minWidth: '300px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const hash = (e.target as HTMLInputElement).value.trim();
                    if (hash.startsWith('Qm') || hash.startsWith('bafy')) {
                      window.open(getPublicUrl(hash), '_blank');
                    } else {
                      alert('Please enter a valid IPFS hash');
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="IPFS hash"]') as HTMLInputElement;
                  const hash = input?.value.trim();
                  if (hash && (hash.startsWith('Qm') || hash.startsWith('bafy'))) {
                    window.open(getPublicUrl(hash), '_blank');
                  } else {
                    alert('Please enter a valid IPFS hash');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--jp-accept-color1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Open
              </button>
            </div>
          </div>
        ) : files.length === 0 ? (
          <p style={{ color: 'var(--jp-ui-font-color2)', fontStyle: 'italic' }}>
            No files found
          </p>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  border: '1px solid var(--jp-border-color2)',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  background: 'var(--jp-layout-color1)'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ 
                    fontWeight: 'bold',
                    fontSize: '12px',
                    color: 'var(--jp-ui-font-color1)',
                    wordBreak: 'break-all'
                  }}>
                    {file.Hash}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleDownload(file.Hash)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--jp-brand-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Download
                  </button>
                  <button
                    onClick={() => window.open(getPublicUrl(file.Hash), '_blank')}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--jp-accept-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IPFSComponent;
