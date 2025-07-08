"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useFactoryRegistry } from "./useFactoryRegistry";
import UserMetadataFactory from "../abis/UserMetadataFactory.json";

export function useAuth() {
  const [account, setAccount] = useState<string | null>(null);
  const { getFactoryAddress } = useFactoryRegistry();

  useEffect(() => {
    const stored = sessionStorage.getItem("auth");
    if (stored) {
      const { account } = JSON.parse(stored);
      setAccount(account);
      console.log("Restored session:", { account });
    }
  }, []);

  const connect = async () => {
    if (!(window as any).ethereum) return;

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();

    setAccount(addr);
    sessionStorage.setItem("auth", JSON.stringify({ account: addr }));
  };

  const disconnect = () => {
    setAccount(null);
    sessionStorage.removeItem("auth");
  };

  // Register user on the blockchain
  const register = async (email: string, name: string, institution: string) => {
    if (!(window as any).ethereum) return;

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    // Get UserMetadataFactory address from registry
    const userMetadataFactoryAddress = await getFactoryAddress("UserMetadataFactory");
    if (!userMetadataFactoryAddress) {
      console.error("Failed to get UserMetadataFactory address from registry");
      return false;
    }

    const userMetadataFactory = new ethers.Contract(
      userMetadataFactoryAddress,
      UserMetadataFactory.abi,
      signer
    );

    try {
      const tx = await userMetadataFactory.registerUser(email, name, institution);
      await tx.wait();
      return true;
    } catch (err) {
      console.error("Registration failed:", err);
      return false;
    }
  };

  // Get factory address from registry
  const getFactoryFromRegistry = async (factoryName: string) => {
    try {
      const address = await getFactoryAddress(factoryName);
      return address;
    } catch (error) {
      console.error(`Failed to get ${factoryName} from registry:`, error);
      return null;
    }
  };

  return { account, connect, disconnect, register, getFactoryFromRegistry };
}
