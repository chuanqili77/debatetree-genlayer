import fs from "node:fs";
import { makeClient, makeAccount, waitFinalized, normalizeStatus } from "./common.mjs";

const code = fs.readFileSync(new URL("../contracts/debatetree.py", import.meta.url), "utf8");
const client = makeClient();
const account = makeAccount();
if (Number(await client.getChainId()) !== 61999 || BigInt(await client.request({method:"eth_gasPrice",params:[]})) !== 0n) throw Error("Expected zero-gas Stable Studionet");
console.log("deployer:", account.address);

const hash = await client.deployContract({ account, code, leaderOnly: false });
console.log("deploy tx:", hash);
const receipt = await waitFinalized(client, hash, { timeoutMs: 900000, intervalMs: 15000 });
console.log("deploy status:", normalizeStatus(receipt));
const leader = [receipt.consensus_data?.leader_receipt].flat().find(item => item?.mode === "leader");
if (normalizeStatus(receipt) !== "FINALIZED" || ![6,"MAJORITY_AGREE"].includes(receipt.result) || leader?.execution_result !== "SUCCESS") throw Error("Deployment did not finalize successfully");
const address = receipt.data?.contract_address || receipt.to_address;
console.log("contract address:", address);
if (!address) {
  console.log("receipt keys:", Object.keys(receipt));
  console.log(JSON.stringify(receipt).slice(0, 2000));
  throw new Error("no contract address in deploy receipt");
}
if (await client.getContractCode(address) !== code) throw Error("Deployed source mismatch");
const out = {
  network: "Stable Studionet",
  chainId: 61999,
  contractAddress: address,
  deployTx: hash,
  deployStatus: normalizeStatus(receipt),
  deployer: account.address,
  sourceSha256: (await import("node:crypto")).createHash("sha256").update(code).digest("hex"),
  protocol: "debatetree-2",
};
fs.mkdirSync(new URL("../evidence", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../evidence/deployment-v2.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
