// Pure tree logic tests (no DOM, no chain).
import assert from "node:assert";

export function winnerOf(forTotal, againstTotal) {
  if (forTotal > againstTotal) return "FOR";
  if (againstTotal > forTotal) return "AGAINST";
  return "TIE";
}

export function meterShares(forTotal, againstTotal) {
  const f = Math.max(0, forTotal);
  const a = Math.max(0, againstTotal);
  const total = f + a;
  if (total === 0) return [50, 50];
  return [(f / total) * 100, (a / total) * 100];
}

export function applyWeight(totals, side, verdict) {
  const w = { SOUND: 2, UNVERIFIED: 0, FLAWED: -1 }[verdict];
  if (w === undefined) throw new Error("bad verdict");
  if (side === "FOR") return { ...totals, for: totals.for + w };
  if (side === "AGAINST") return { ...totals, against: totals.against + w };
  throw new Error("bad side");
}

assert.equal(winnerOf(2, 1), "FOR");
assert.equal(winnerOf(1, 2), "AGAINST");
assert.equal(winnerOf(2, 2), "TIE");
assert.equal(winnerOf(-1, -1), "TIE");
assert.deepEqual(meterShares(2, 1).map((x) => Math.round(x)), [67, 33]);
assert.deepEqual(meterShares(0, 0), [50, 50]);
assert.deepEqual(meterShares(-1, 2), [0, 100]);
assert.deepEqual(applyWeight({ for: 0, against: 0 }, "FOR", "SOUND"), { for: 2, against: 0 });
assert.deepEqual(applyWeight({ for: 2, against: 0 }, "AGAINST", "FLAWED"), { for: 2, against: -1 });
assert.deepEqual(applyWeight({ for: 2, against: -1 }, "FOR", "UNVERIFIED"), { for: 2, against: -1 });
assert.throws(() => applyWeight({ for: 0, against: 0 }, "NEUTRAL", "SOUND"));
assert.throws(() => applyWeight({ for: 0, against: 0 }, "FOR", "MAYBE"));
console.log("tree tests pass");
