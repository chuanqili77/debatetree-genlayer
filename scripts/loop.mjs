import fs from "node:fs";
import { makeClient, makeAccount, write, readSpaced, sleep } from "./common.mjs";

const deployment = JSON.parse(fs.readFileSync(new URL("../evidence/deployment.json", import.meta.url), "utf8"));
const ADDR = deployment.contractAddress;
const client = makeClient();
const creator = makeAccount();
const alice = makeAccount();
const bob = makeAccount();
const carol = makeAccount();
console.log("contract:", ADDR);
console.log("creator:", creator.address);
console.log("alice:", alice.address);
console.log("bob:", bob.address);
console.log("carol:", carol.address);

const steps = [];
async function step(label, fn, expect) {
  const started = Date.now();
  try {
    const result = await fn();
    const row = { label, ...result, expect, ms: Date.now() - started };
    steps.push(row);
    console.log(`${label}: hash=${result.hash?.slice(0, 12)} status=${result.status} execution=${result.execution} error=${result.errorCode} expect=${expect}`);
    return result;
  } catch (e) {
    const row = { label, error: String(e).slice(0, 300), expect, ms: Date.now() - started };
    steps.push(row);
    console.log(`${label}: SCRIPT_ERROR ${String(e).slice(0, 200)}`);
    throw e;
  }
}
async function w(account, fn, args) {
  return write(client, account, ADDR, fn, args);
}
async function rd(fn, args) {
  return readSpaced(client, ADDR, fn, args);
}
const parse = (s) => (typeof s === "string" && s ? JSON.parse(s) : s);

const TOPIC = "Should example domains be used in documentation?";
const DESC = "A debate about whether reserved example domains are suitable for use in technical documentation and literature.";
const EX = "https://example.com/";
const UNREACH = "https://example.com/this-page-does-not-exist-xyz";

// 1. debate-0
const d0 = parse((await step("create-debate-0", () => w(creator, "create_debate", [TOPIC, DESC]), "SUCCESS")).receipt && (await rd("get_debate", ["debate-0"])));
console.log("debate-0:", JSON.stringify(d0).slice(0, 300));

// 2-6. arguments on debate-0
await step("post-arg-0-FOR-SOUND", () => w(alice, "post_argument", ["debate-0", "FOR", "Example Domain is reserved for illustrative examples in documents.", EX, ""]), "SUCCESS");
await step("post-arg-1-FOR-UNVERIFIED", () => w(bob, "post_argument", ["debate-0", "FOR", "Example Domain proves quantum supremacy was achieved in 2024.", EX, ""]), "SUCCESS");
await step("post-arg-2-AGAINST-FLAWED", () => w(carol, "post_argument", ["debate-0", "AGAINST", "Example Domain's page says you must ask for permission before using the domain.", EX, ""]), "SUCCESS");
await step("post-arg-3-AGAINST-SOUND", () => w(alice, "post_argument", ["debate-0", "AGAINST", "Example Domain may be used in literature without asking for permission.", EX, ""]), "SUCCESS");
await step("post-arg-4-FOR-UNREACHABLE", () => w(bob, "post_argument", ["debate-0", "FOR", "Example Domain's missing page supports this claim.", UNREACH, ""]), "SUCCESS");

// 7-10. assessments (verdicts recorded as observed, not asserted mid-run)
await step("assess-arg-0", () => w(creator, "assess_argument", ["arg-0"]), "SOUND");
await step("assess-arg-1", () => w(creator, "assess_argument", ["arg-1"]), "UNVERIFIED");
await step("assess-arg-2", () => w(creator, "assess_argument", ["arg-2"]), "FLAWED");
await step("assess-arg-3", () => w(creator, "assess_argument", ["arg-3"]), "SOUND");

// 11. unreachable assess must fail closed
await step("assess-arg-4-unreachable", () => w(creator, "assess_argument", ["arg-4"]), "ERROR");
const arg4 = parse(await rd("get_argument", ["arg-4"]));
console.log("arg-4 after failed assess:", arg4?.status, arg4?.verdict);

// 12. readback debate-0 totals
const mid0 = parse(await rd("get_debate", ["debate-0"]));
console.log("debate-0 mid:", JSON.stringify({ for_total: mid0.for_total, against_total: mid0.against_total, assessed_count: mid0.assessed_count, status: mid0.status }));

// 13-16. debate-1: one assessed arg, close must fail
await step("create-debate-1", () => w(creator, "create_debate", ["Second debate topic here", "A second debate used to prove the close guard."]), "SUCCESS");
await step("post-arg-5-debate-1", () => w(alice, "post_argument", ["debate-1", "FOR", "Example Domain is reserved for illustrative examples in documents.", EX, ""]), "SUCCESS");
await step("assess-arg-5", () => w(creator, "assess_argument", ["arg-5"]), "SOUND");
await step("close-debate-1-too-early", () => w(creator, "close_debate", ["debate-1"]), "ERROR INVALID_STATUS");

// 17. close debate-0
await step("close-debate-0", () => w(creator, "close_debate", ["debate-0"]), "CLOSED winner FOR");

// 18-22. negatives on closed debate-0 / debate-1
await step("assess-closed-debate-pending-arg", () => w(creator, "assess_argument", ["arg-4"]), "ERROR ALREADY_CLOSED");
await step("post-to-closed-debate", () => w(alice, "post_argument", ["debate-0", "FOR", "Late claim about Example Domain here.", EX, ""]), "ERROR ALREADY_CLOSED");
await step("close-debate-0-again", () => w(creator, "close_debate", ["debate-0"]), "ERROR ALREADY_CLOSED");
await step("close-debate-1-by-nonauthor", () => w(alice, "close_debate", ["debate-1"]), "ERROR UNAUTHORIZED");
await step("post-bad-side", () => w(alice, "post_argument", ["debate-1", "NEUTRAL", "Neutral claim about Example Domain here.", EX, ""]), "ERROR INVALID_SIDE");

// 23-28. fill creator cap (debate-0, debate-1 exist; add debate-2..debate-7)
for (let i = 2; i <= 7; i++) {
  await step(`create-debate-${i}`, () => w(creator, "create_debate", [`Cap debate number ${i} here`, "A filler debate used to prove the per-creator cap."]), "SUCCESS");
}
// 29. cap must fail
await step("create-debate-9-cap", () => w(creator, "create_debate", ["One debate too many here", "This create must fail on the per-creator cap."]), "ERROR DEBATE_CAP");

// 30. final readbacks
const final0 = parse(await rd("get_debate", ["debate-0"]));
const final1 = parse(await rd("get_debate", ["debate-1"]));
const counts = parse(await rd("get_counts", []));
const args = {};
for (let i = 0; i <= 5; i++) {
  args[`arg-${i}`] = parse(await rd("get_argument", [`arg-${i}`]));
}
console.log("FINAL debate-0:", JSON.stringify(final0));
console.log("FINAL debate-1:", JSON.stringify(final1));
console.log("FINAL counts:", JSON.stringify(counts));
for (const [k, v] of Object.entries(args)) {
  console.log(`FINAL ${k}:`, JSON.stringify({ side: v.side, status: v.status, verdict: v.verdict, weight: v.weight }));
}

fs.writeFileSync(new URL("../evidence/loop.json", import.meta.url), JSON.stringify({
  contractAddress: ADDR,
  accounts: { creator: creator.address, alice: alice.address, bob: bob.address, carol: carol.address },
  steps: steps.map(({ receipt, ...rest }) => rest),
  final: { debate0: final0, debate1: final1, counts, args },
}, null, 2));
console.log("loop done, steps:", steps.length);
