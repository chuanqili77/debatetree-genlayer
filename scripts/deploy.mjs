import fs from "node:fs";
import { makeClient, makeAccount, waitFinalized, normalizeStatus } from "./common.mjs";

const code = fs.readFileSync(new URL("../contracts/debatetree.py", import.meta.url), "utf8");
const client = makeClient();
const account = makeAccount();
console.log("deployer:", account.address);

const hash = await client.deployContract({ account, code });
console.log("deploy tx:", hash);
const receipt = await waitFinalized(client, hash, { timeoutMs: 900000, intervalMs: 15000 });
console.log("deploy status:", normalizeStatus(receipt));
const address = receipt.data?.contract_address || receipt.to_address;
console.log("contract address:", address);
if (!address) {
  console.log("receipt keys:", Object.keys(receipt));
  console.log(JSON.stringify(receipt).slice(0, 2000));
  throw new Error("no contract address in deploy receipt");
}
const out = {
  network: "Stable Studionet",
  chainId: 61999,
  contractAddress: address,
  deployTx: hash,
  deployStatus: normalizeStatus(receipt),
  deployer: account.address,
  sourceSha256: (await import("node:crypto")).createHash("sha256").update(code).digest("hex"),
  protocol: "debatetree-1",
};
fs.mkdirSync(new URL("../evidence", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../evidence/deployment.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
