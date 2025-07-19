# MetaMask Connection Troubleshooting Guide

## Overview
This guide helps you troubleshoot MetaMask connection issues in the DVRE JupyterLab extension.

## Quick Fixes

### 1. Basic Checks
- [ ] MetaMask extension is installed in your browser
- [ ] MetaMask is unlocked (you've entered your password)
- [ ] You have at least one account in MetaMask
- [ ] You're on the correct network (check the network dropdown in MetaMask)

### 2. Common Issues and Solutions

#### Issue: "MetaMask is not installed"
**Solution:**
1. Install MetaMask from [metamask.io](https://metamask.io/download/)
2. Create or import a wallet
3. Refresh the JupyterLab page

#### Issue: "Connection rejected by user"
**Solution:**
1. Click the MetaMask extension icon
2. Look for pending connection requests
3. Click "Connect" to approve the connection
4. If no pending requests, try clicking "Connect MetaMask" again

#### Issue: "Connection request already pending"
**Solution:**
1. Open MetaMask extension
2. Look for pending connection requests
3. Either approve or reject the pending request
4. Try connecting again

#### Issue: "No accounts found"
**Solution:**
1. Make sure MetaMask is unlocked
2. Check that you have at least one account
3. If you have multiple accounts, make sure one is selected

#### Issue: "Insufficient funds for transaction"
**Solution:**
1. Check your wallet balance
2. Ensure you have enough ETH for gas fees
3. Consider switching to a testnet if you're testing

## Using the Debug Tool

The extension includes a built-in debug tool to help diagnose issues:

1. Open the Authentication tool in JupyterLab
2. Click the "Show Debug" button
3. The debug panel will show detailed information about:
   - MetaMask availability
   - Connection status
   - Network information
   - Error messages

### Debug Information Explained

- **isMetaMaskAvailable**: Whether MetaMask is detected in the browser
- **account**: Your connected wallet address (if connected)
- **isConnecting**: Whether a connection attempt is in progress
- **connectionError**: Any error messages from connection attempts
- **ethereum.isMetaMask**: Confirms it's actually MetaMask (not another wallet)
- **ethereum.selectedAddress**: Your currently selected account
- **ethereum.networkVersion**: The network you're connected to
- **ethereum.chainId**: The chain ID of your current network
- **ethereum.isConnected**: Whether MetaMask is connected to the site

## Step-by-Step Troubleshooting

### Step 1: Check MetaMask Installation
1. Open your browser's extension manager
2. Look for MetaMask in the list
3. If not found, install it from [metamask.io](https://metamask.io/download/)

### Step 2: Verify MetaMask is Working
1. Click the MetaMask extension icon
2. Make sure it opens without errors
3. Ensure you can see your accounts
4. Check that you're on the correct network

### Step 3: Test Connection in JupyterLab
1. Open the Authentication tool
2. Click "Connect MetaMask"
3. Look for the MetaMask popup
4. Approve the connection if prompted

### Step 4: Use Debug Information
1. Click "Show Debug" in the Authentication tool
2. Click "Test Connection" to attempt a connection
3. Review the debug information for any errors
4. Use "Copy Debug Info" to share with support if needed

## Network Configuration

### Supported Networks
The extension should work with:
- Ethereum Mainnet
- Ethereum Testnets (Goerli, Sepolia)
- Local development networks

### Network Issues
If you're having network-related issues:
1. Check that you're on the correct network in MetaMask
2. Ensure your RPC endpoint is working
3. Try switching networks and back

## Browser-Specific Issues

### Chrome/Edge
- Most common and well-supported
- Make sure MetaMask extension is enabled
- Check for any ad-blockers that might interfere

### Firefox
- MetaMask works well in Firefox
- Make sure you're using the official MetaMask extension
- Check Firefox's privacy settings

### Safari
- MetaMask support may be limited
- Consider using Chrome or Firefox for best compatibility

## Advanced Troubleshooting

### Clear Browser Data
If nothing else works:
1. Clear browser cache and cookies
2. Disable and re-enable MetaMask extension
3. Restart your browser
4. Try connecting again

### Check Console Errors
1. Open browser developer tools (F12)
2. Go to the Console tab
3. Look for any error messages related to MetaMask
4. Note any error codes or messages

### Reset MetaMask (Last Resort)
⚠️ **Warning: This will remove all your accounts and you'll need to re-import them**
1. Open MetaMask
2. Go to Settings > Advanced
3. Click "Reset Account"
4. Re-import your accounts using your seed phrase

## Getting Help

If you're still having issues:

1. **Use the Debug Tool**: Copy the debug information and include it in your support request
2. **Check Console**: Look for any JavaScript errors in the browser console
3. **Document Steps**: Write down exactly what you did and what error messages you saw
4. **Browser Info**: Include your browser type and version
5. **MetaMask Version**: Check your MetaMask version in the extension settings

## Prevention Tips

- Keep MetaMask updated to the latest version
- Use a supported browser (Chrome, Firefox, Edge)
- Don't use multiple wallet extensions simultaneously
- Keep your MetaMask seed phrase safe and secure
- Regularly check for extension updates

## Common Error Codes

- **4001**: User rejected the request
- **-32002**: Request already pending
- **-32603**: Internal JSON-RPC error
- **-32700**: Parse error
- **-32600**: Invalid request
- **-32601**: Method not found
- **-32602**: Invalid params

## Security Notes

- Never share your MetaMask seed phrase
- Only connect to trusted sites
- Be careful with transaction approvals
- Use hardware wallets for large amounts
- Keep your MetaMask password secure 