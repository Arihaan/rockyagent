const { ethers } = require('ethers');
const config = require('../config');

// Initialize provider
const provider = new ethers.JsonRpcProvider(config.blockchain.baseSepolia.rpc);

// Initialize DAO wallet
const daoWallet = new ethers.Wallet(config.blockchain.daoPrivateKey, provider);

// Get DAO wallet balance
const getWalletBalance = async () => {
  const balance = await provider.getBalance(daoWallet.address);
  return ethers.formatEther(balance);
};

// Send ETH transaction
const sendTransaction = async (to, amount) => {
  const tx = await daoWallet.sendTransaction({
    to,
    value: ethers.parseEther(amount.toString())
  });
  
  return {
    txHash: tx.hash,
    from: daoWallet.address,
    to,
    amount,
  };
};

// Execute contract call
const executeContractCall = async (contractAddress, abi, methodName, params = []) => {
  const contract = new ethers.Contract(contractAddress, abi, daoWallet);
  const tx = await contract[methodName](...params);
  const receipt = await tx.wait();
  
  return {
    txHash: receipt.hash,
    contractAddress,
    methodName,
    params,
  };
};

module.exports = {
  daoWallet,
  getWalletBalance,
  sendTransaction,
  executeContractCall,
}; 