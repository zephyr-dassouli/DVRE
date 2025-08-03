const Web3 = require("web3").default;
const { config } = require("dotenv");
config();

const raw = process.env.PRIVATE_KEY;
const privateKey = raw?.trim();

console.log("Raw key:", raw);
console.log("Trimmed key:", privateKey);
console.log("Length:", privateKey?.length);

try {
  const web3 = new Web3();
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  console.log("✅ Address:", account.address);
} catch (err) {
  console.error("❌ Error:", err.message);
}
