import assert from "node:assert/strict";
import fs from "node:fs";
import { makeAccount, makeClient, waitFinalized } from "./common.mjs";

const {contractAddress:address} = JSON.parse(fs.readFileSync(new URL("../evidence/deployment-v2.json",import.meta.url)));
const client = makeClient();
const creator = makeAccount();
const authors = [makeAccount(), makeAccount(), makeAccount()];
const repository = "https://raw.githubusercontent.com/chuanqili77/debatetree-genlayer/cfe655b8f9ac2784e375bfedfa7bb43eca0b33c5/evidence/appeal-scenarios/";
const original = repository + "preliminary.txt";
const counter = [repository + "correction.txt", repository + "unrelated.txt", repository + "correction.txt"];
const claims = [
  "The Linden town library opens at 10:00 on Saturdays.",
  "The Linden town library opens at 10:00 on Sundays.",
  "The Linden town library opens at 11:00 on Saturdays.",
];
const transactions = {};
const view = async (functionName,args=[]) => {
  const result = await client.readContract({address,functionName,args,transactionHashVariant:"latest-final"});
  return result ? JSON.parse(result) : null;
};

assert.equal(Number(await client.getChainId()), 61999);
assert.equal(BigInt(await client.request({method:"eth_gasPrice",params:[]})), 0n);

async function step(label, account, functionName, args, error) {
  const hash = await client.writeContract({account,address,functionName,args,value:0n,leaderOnly:false});
  transactions[label] = {hash, sender:account.address, functionName, args, ...(error ? {error} : {})};
  fs.writeFileSync(new URL("../evidence/.v2-progress.json",import.meta.url), JSON.stringify(transactions,null,2));
  console.log(label,hash);
  const tx = await waitFinalized(client,hash,{intervalMs:5000});
  assert.ok(tx.status===7 || tx.statusName==="FINALIZED");
  assert.ok([6,"MAJORITY_AGREE"].includes(tx.result));
  const leader = [tx.consensus_data?.leader_receipt].flat().find(item=>item?.mode==="leader");
  assert.equal(leader?.execution_result,error ? "ERROR" : "SUCCESS");
  if (error) assert.equal(leader.result.payload,error);
  console.log(label,"FINALIZED",error ?? "SUCCESS");
}

const before = await view("get_counts");
const debateId = "debate-" + before.debate_count;
await step("created",creator,"create_debate",["Library schedule appeals","Three independent authors demonstrate a correction, an upheld ruling, and withdrawal."]);
await Promise.all(claims.map((claim,i)=>step("posted_"+i,authors[i],"post_argument",[debateId,i===1?"AGAINST":"FOR",claim,original,"Fictional library fixture"])));
const getDebate = () => view("get_debate",[debateId]);
const ids = (await getDebate()).argument_ids;
const rows = await Promise.all(ids.map(id=>view("get_argument",[id])));
const args = claims.map(claim=>rows.find(row=>row.claim===claim).id);
await Promise.all(args.map((id,i)=>step("assessed_"+i,authors[i],"assess_argument",[id])));
const baseline = await getDebate();
const prior = await Promise.all(args.map(id=>view("get_argument",[id])));
assert.equal(prior[0].verdict,"FLAWED");
assert.ok(prior.every(row=>row.verdict!=="SOUND"));
await Promise.all([
  ...args.map((id,i)=>step("filed_"+i,authors[i],"file_appeal",[id,counter[i],i===0?"The updated schedule explicitly replaces the preliminary opening time.":"Review this second source in relation to the posted opening hours."])),
  step("wrong_author",creator,"file_appeal",[args[0],counter[0],"I am not the argument author."],"UNAUTHORIZED"),
]);
assert.equal((await getDebate()).pending_appeals,3);
await step("blocked_close",creator,"close_debate",[debateId],"APPEALS_PENDING");
await Promise.all([
  step("reversed",authors[0],"resolve_appeal",[args[0]]),
  step("upheld",authors[1],"resolve_appeal",[args[1]]),
  step("withdrawn",authors[2],"end_appeal",[args[2]]),
]);
const finalArgs = await Promise.all(args.map(id=>view("get_argument",[id])));
assert.deepEqual(finalArgs.map(row=>row.appeal.status),["REVERSED","UPHELD","WITHDRAWN"]);
assert.deepEqual(finalArgs.map(row=>row.appeal.delta),[3,0,0]);
assert.equal((await getDebate()).for_total,baseline.for_total + 3);
assert.equal((await getDebate()).against_total,baseline.against_total);
await Promise.all([
  step("blocked_replay",authors[0],"resolve_appeal",[args[0]],"NO_PENDING_APPEAL"),
  step("closed",creator,"close_debate",[debateId]),
]);
const final = await getDebate();
assert.equal(final.status,"CLOSED");
assert.equal(final.pending_appeals,0);
assert.equal(final.assessed_count,3);
assert.equal(final.for_total,baseline.for_total+3);
assert.equal(final.winner,"FOR");
fs.writeFileSync(new URL("../evidence/appeals-v2.json",import.meta.url),JSON.stringify({
  address, debateId, baseline, final, arguments:finalArgs, transactions,
},null,2)+"\n");
