// End-to-end tests against a running Ganache (npm run ganache) using a FRESH deployment.
// Accounts: [0] issuer, [1] student, [2] outsider (attacker)
const assert = require("assert");
const { JsonRpcProvider, ContractFactory, keccak256, toUtf8Bytes, ZeroHash } = require("ethers");
const { abi, bytecode } = require("../build/CertificateRegistry.json");

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  PASS ", name); }
  catch (e) { fail++; console.log("  FAIL ", name, "->", e.message); }
}
// Simulates the call (eth_call) so Ganache returns the decoded custom error, then also
// sends a real transaction with a fixed gas limit and checks that it does not change state.
async function rv(contract, method, args, errName) {
  try { await contract[method].staticCall(...args); }
  catch (e) { assert.equal(e.revert && e.revert.name, errName, `expected ${errName}, got ${e.revert && e.revert.name}`); return; }
  throw new Error(`expected revert ${errName} but call succeeded`);
}

(async () => {
  const provider = new JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:7545");
  const [issuer, student, outsider] = [await provider.getSigner(0), await provider.getSigner(1), await provider.getSigner(2)];
  const studentAddr = await student.getAddress();
  const c = await (await new ContractFactory(abi, bytecode, issuer).deploy()).waitForDeployment();
  const asOutsider = c.connect(outsider), asStudent = c.connect(student);

  const ID = "DTU-2026-0001";
  const doc = keccak256(toUtf8Bytes("Bachelor of Data Science - Tran Bao Duy"));
  const tampered = keccak256(toUtf8Bytes("Bachelor of Data Science - SOMEONE ELSE"));

  console.log("Certificate Verification tests");
  await t("issuer is deployer", async () => assert.equal(await c.issuer(), await issuer.getAddress()));

  await t("issuer issues certificate + emits CertificateIssued", async () => {
    const r = await (await c.issue(ID, studentAddr, doc)).wait();
    const ev = r.logs.map((l) => c.interface.parseLog(l)).find((x) => x && x.name === "CertificateIssued");
    assert.ok(ev); assert.equal(ev.args.id, ID); assert.equal(ev.args.recipient, studentAddr); assert.equal(ev.args.docHash, doc);
    assert.equal(await c.totalIssued(), 1n);
  });

  await t("stored data is correct and certificate is valid", async () => {
    const x = await c.getCertificate(ID);
    assert.equal(x.recipient, studentAddr); assert.equal(x.docHash, doc); assert.equal(x.revoked, false);
    assert.equal(await c.isValid(ID), true);
  });

  await t("verify: correct hash -> valid", async () => {
    const [exists, hashMatch, valid] = await c.verify(ID, doc);
    assert.deepEqual([exists, hashMatch, valid], [true, true, true]);
  });

  await t("verify: wrong hash -> exists but not matching/valid", async () => {
    const [exists, hashMatch, valid] = await c.verify(ID, tampered);
    assert.deepEqual([exists, hashMatch, valid], [true, false, false]);
  });

  await t("verify: unknown ID -> not found", async () => {
    const [exists, , valid] = await c.verify("NOPE", doc);
    assert.equal(exists, false); assert.equal(valid, false);
  });

  await t("REJECT duplicate ID (DuplicateId)", async () => { await rv(c, "issue", [ID, studentAddr, tampered], "DuplicateId"); });
  await t("REJECT unauthorized issue by outsider (NotIssuer)", async () => { await rv(asOutsider, "issue", ["X-1", studentAddr, doc], "NotIssuer"); });
  await t("REJECT unauthorized issue by student (NotIssuer)", async () => { await rv(asStudent, "issue", ["X-2", studentAddr, doc], "NotIssuer"); });
  await t("REJECT unauthorized revoke by outsider (NotIssuer)", async () => { await rv(asOutsider, "revoke", [ID], "NotIssuer"); });
  await t("outsider's forced transaction is mined as FAILED and changes nothing", async () => {
    const tx = await asOutsider.revoke(ID, { gasLimit: 200000 });
    let status = null;
    try { status = (await tx.wait()).status; } catch (e) { status = e.receipt ? e.receipt.status : 0; }
    assert.equal(status, 0);
  });
  await t("still valid after failed attacks", async () => assert.equal(await c.isValid(ID), true));
  await t("REJECT empty ID / zero recipient / zero hash", async () => {
    await rv(c, "issue", ["", studentAddr, doc], "EmptyId");
    await rv(c, "issue", ["Y-1", "0x0000000000000000000000000000000000000000", doc], "ZeroRecipient");
    await rv(c, "issue", ["Y-2", studentAddr, ZeroHash], "EmptyHash");
  });
  await t("REJECT revoke of unknown ID (UnknownId)", async () => { await rv(c, "revoke", ["GHOST"], "UnknownId"); });

  await t("issuer revokes + emits CertificateRevoked", async () => {
    const r = await (await c.revoke(ID)).wait();
    const ev = r.logs.map((l) => c.interface.parseLog(l)).find((x) => x && x.name === "CertificateRevoked");
    assert.ok(ev); assert.equal(ev.args.id, ID);
  });
  await t("after revoke: isValid false, verify valid=false but hashMatch=true", async () => {
    assert.equal(await c.isValid(ID), false);
    const [exists, hashMatch, valid] = await c.verify(ID, doc);
    assert.deepEqual([exists, hashMatch, valid], [true, true, false]);
    assert.ok((await c.getCertificate(ID)).revokedAt > 0n);
  });
  await t("REJECT double revoke (AlreadyRevoked)", async () => { await rv(c, "revoke", [ID], "AlreadyRevoked"); });
  await t("revoked ID cannot be re-issued (DuplicateId)", async () => { await rv(c, "issue", [ID, studentAddr, doc], "DuplicateId"); });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
