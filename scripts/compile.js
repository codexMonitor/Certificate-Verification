// Compiles contracts/CertificateRegistry.sol with solc-js and writes build/CertificateRegistry.json
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const file = path.join(__dirname, "..", "contracts", "CertificateRegistry.sol");
const input = {
  language: "Solidity",
  sources: { "CertificateRegistry.sol": { content: fs.readFileSync(file, "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris", // widely supported by Ganache
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
let failed = false;
for (const e of out.errors || []) {
  console.log(e.formattedMessage);
  if (e.severity === "error") failed = true;
}
if (failed) process.exit(1);

const c = out.contracts["CertificateRegistry.sol"].CertificateRegistry;
const buildDir = path.join(__dirname, "..", "build");
fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(
  path.join(buildDir, "CertificateRegistry.json"),
  JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2)
);
console.log("Compiled OK -> build/CertificateRegistry.json");
