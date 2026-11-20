import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {makeClient,waitFinalized} from "./common.mjs";

const load = path => JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const deployment = load("../evidence/deployment-v2.json");
const evidence = load("../evidence/appeals-v2.json");
const {contractAddress:address} = deployment;
const client = makeClient();
const source = fs.readFileSync(new URL("../contracts/debatetree.py",import.meta.url),"utf8");
assert.equal(Number(await client.getChainId()),61999);
assert.equal(evidence.address,address);
assert.equal(await client.getContractCode(address),source);
assert.equal(createHash("sha256").update(source).digest("hex"),deployment.sourceSha256);

async function receipt(hash, reason) {
  const tx = await waitFinalized(client,hash,{intervalMs:5000,timeoutMs:90000});
  assert.ok(tx.status===7 || tx.statusName==="FINALIZED",hash);
  assert.ok([6,"MAJORITY_AGREE"].includes(tx.result),hash);
  const leader = [tx.consensus_data?.leader_receipt].flat().find(item=>item?.mode==="leader");
  assert.equal(leader?.execution_result,reason ? "ERROR" : "SUCCESS",hash);
  if (reason) assert.equal(leader.result.payload,reason,hash);
  return {tx,leader};
}

const {tx:provision} = await receipt(deployment.deployTx);
assert.equal(provision.data.contract_address.toLowerCase(),address.toLowerCase());
for (const [label, entry] of Object.entries(evidence.transactions)) {
  const {tx,leader} = await receipt(entry.hash,entry.error);
  assert.equal(tx.to_address.toLowerCase(),address.toLowerCase());
  assert.equal(tx.from_address.toLowerCase(),entry.sender.toLowerCase());
  const args = entry.args.map(value => JSON.stringify(value) + ",").join("");
  assert.equal(leader.calldata.readable, '{"args":[' + args + ']"method":' + JSON.stringify(entry.functionName) + '}');
  console.log(label,entry.error ?? "SUCCESS");
}
const view = async (functionName,args)=>JSON.parse(await client.readContract({address,functionName,args,transactionHashVariant:"latest-final"}));
assert.deepEqual(await view("get_debate",[evidence.debateId]),evidence.final);
for (const argument of evidence.arguments) {
  assert.deepEqual(await view("get_argument",[argument.id]),argument);
}
assert.equal(evidence.final.for_total-evidence.baseline.for_total,3);
assert.equal(evidence.final.against_total,evidence.baseline.against_total);
assert.equal(evidence.final.pending_appeals,0);
assert.deepEqual(evidence.arguments.map(row=>row.appeal.status),["REVERSED","UPHELD","WITHDRAWN"]);
console.log("Byte parity, finalized receipts and appeal readbacks verified.");
