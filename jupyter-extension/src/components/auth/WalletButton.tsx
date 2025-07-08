import { useEffect, useState } from "react";
import {useAuth} from "../../hooks/useAuth";
import { useFactoryRegistry } from "../../hooks/useFactoryRegistry";
import { ethers } from "ethers";
import UserMetadataFactory from "../../abis/UserMetadataFactory.json";

import UserMetadataForm from "./UserMetadataForm";
import UserMetadataDisplay from "./UserMetadataDisplay";
import React from "react";

export default function WalletButton({ setUserAccount }: { setUserAccount: (account: string | null) => void }) {
  const { account, connect, disconnect, register } = useAuth();
  const { getFactoryAddress, loading: registryLoading, error: registryError } = useFactoryRegistry();

  const [metadata, setMetadata] = useState<{ email: string; name: string; institution: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Fetch user metadata if connected
  useEffect(() => {
    if (account) {
      setUserAccount(account);
      fetchMetadata(account);
    } else {
      setUserAccount(null);
      setMetadata(null);
      setShowRegister(false);
    }
  }, [account]);

  // Check if user is registered and fetch metadata
  const fetchMetadata = async (userAddress: string) => {
    setFetchingMetadata(true);
    try {
      // Get UserMetadataFactory address from registry
      const userMetadataFactoryAddress = await getFactoryAddress("UserMetadataFactory");
      
      if (!userMetadataFactoryAddress) {
        console.error("UserMetadataFactory not found in registry");
        setShowRegister(true);
        setMetadata(null);
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(userMetadataFactoryAddress, UserMetadataFactory.abi, provider);
      const metadataAddr = await contract.getUserMetadataContract(userAddress);
      if (metadataAddr === ethers.ZeroAddress || metadataAddr === "0x0000000000000000000000000000000000000000") {
        setShowRegister(true);
        setMetadata(null);
      } else {
        const metadataJSON = await contract.getUserMetadataJSON(userAddress);
        const parsed = JSON.parse(metadataJSON);
        setMetadata(parsed);
        setShowRegister(false);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
      setShowRegister(true);
      setMetadata(null);
    } finally {
      setFetchingMetadata(false);
    }
  };

  // Handle registration form submission
  const handleRegister = async (email: string, name: string, institution: string) => {
    const success = await register(email, name, institution);
    if (success && account) {
      await fetchMetadata(account);
    }
  };

  return (
    <div>
      {registryError && (
        <div style={{
          padding: '8px',
          backgroundColor: 'var(--jp-error-color3)',
          color: 'var(--jp-error-color1)',
          borderRadius: '4px',
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          Registry Error: {registryError}
        </div>
      )}
      
      {account ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '16px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '4px',
          backgroundColor: 'var(--jp-layout-color0)'
        }}>
          <p><span style={{ fontWeight: 'bold' }}>Connected:</span> {account}</p>
          
          {fetchingMetadata ? (
            <div style={{ 
              padding: '8px', 
              textAlign: 'center', 
              color: 'var(--jp-ui-font-color2)',
              fontSize: '12px'
            }}>
              Loading user metadata...
            </div>
          ) : metadata ? (
            <UserMetadataDisplay metadata={metadata} />
          ) : showRegister ? (
            <UserMetadataForm onRegister={handleRegister} />
          ) : null}
          
          <button
            style={{
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '8px',
              transition: 'opacity 0.2s',
              backgroundColor: 'var(--jp-error-color1)',
              color: 'var(--jp-ui-inverse-font-color1)',
              border: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          style={{
            borderRadius: '4px',
            cursor: registryLoading ? 'not-allowed' : 'pointer',
            padding: '8px',
            transition: 'opacity 0.2s',
            backgroundColor: registryLoading ? 'var(--jp-layout-color2)' : 'var(--jp-brand-color1)',
            color: 'var(--jp-ui-inverse-font-color1)',
            border: 'none',
            opacity: registryLoading ? 0.6 : 1
          }}
          onMouseEnter={(e) => !registryLoading && (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={(e) => !registryLoading && (e.currentTarget.style.opacity = '1')}
          onClick={connect}
          disabled={registryLoading}
        >
          {registryLoading ? 'Loading Registry...' : 'Connect MetaMask'}
        </button>
      )}
    </div>
  );
}