// Deploys CertificateRegistry to Ganache using account[0] (the issuer).
// Usage: npm run deploy   (env: RPC_URL, default http://127.0.0.1:7545)
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, ContractFactory } = require("ethers");

(async () => {
  const rpc = process.env.RPC_URL || "http://127.0.0.1:7545";
  const provider = new JsonRpcProvider(rpc);
  const net = await provider.getNetwork();
  console.log(`Connected to ${rpc} (chainId ${net.chainId})`);

  const signer = await provider.getSigner(0); // Ganache unlocked test account #0
  const addr = await signer.getAddress();
  console.log("Deployer / issuer:", addr);

  const { abi, bytecode } = require("../build/CertificateRegistry.json");
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  const receipt = await contract.deploymentTransaction().wait();
  const address = await contract.getAddress();
  console.log("Deployed at:", address, "| block", receipt.blockNumber, "| gas", receipt.gasUsed.toString());

  const config = { rpcUrl: rpc, chainId: Number(net.chainId), address, abi };
  fs.writeFileSync(path.join(__dirname, "..", "web", "config.json"), JSON.stringify(config, null, 2));
  console.log("Wrote web/config.json");
})().catch((e) => { console.error(e); process.exit(1); });
