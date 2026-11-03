import fs from "node:fs";
import { makeClient, readSpaced } from "./common.mjs";

// Independent readback: a fresh client re-reads every record the loop
// claims as final state and compares field by field.
const loop = JSON.parse(fs.readFileSync(new URL("../evidence/loop.json", import.meta.url), "utf8"));
const ADDR = loop.contractAddress;
const client = makeClient();
const parse = (s) => (typeof s === "string" && s ? JSON.parse(s) : s);

let mismatches = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) mismatches++;
  console.log(`${ok ? "MATCH" : "MISMATCH"} ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

const d0 = parse(await readSpaced(client, ADDR, "get_debate", ["debate-0"]));
const d1 = parse(await readSpaced(client, ADDR, "get_debate", ["debate-1"]));
const counts = parse(await readSpaced(client, ADDR, "get_counts", []));
check("debate-0.status", d0.status, loop.final.debate0.status);
check("debate-0.winner", d0.winner, loop.final.debate0.winner);
check("debate-0.for_total", d0.for_total, loop.final.debate0.for_total);
check("debate-0.against_total", d0.against_total, loop.final.debate0.against_total);
check("debate-0.assessed_count", d0.assessed_count, loop.final.debate0.assessed_count);
check("debate-0.argument_count", d0.argument_count, loop.final.debate0.argument_count);
check("debate-1.status", d1.status, loop.final.debate1.status);
check("debate-1.assessed_count", d1.assessed_count, loop.final.debate1.assessed_count);
check("counts", counts, loop.final.counts);
for (let i = 0; i <= 5; i++) {
  const a = parse(await readSpaced(client, ADDR, "get_argument", [`arg-${i}`]));
  const e = loop.final.args[`arg-${i}`];
  check(`arg-${i}.status`, a.status, e.status);
  check(`arg-${i}.verdict`, a.verdict, e.verdict);
  check(`arg-${i}.weight`, a.weight, e.weight);
  check(`arg-${i}.side`, a.side, e.side);
}
const out = { contractAddress: ADDR, mismatches, checkedAt: new Date().toISOString() };
fs.writeFileSync(new URL("../evidence/readback.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(mismatches === 0 ? "READBACK: all match" : `READBACK: ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
