import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const RPC = "https://studio.genlayer.com/api";
export const STATUS_NAME = {
  0: "UNINITIALIZED", 1: "PENDING", 2: "PROPOSING", 3: "COMMITTING",
  4: "REVEALING", 5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED",
  8: "CANCELED", 9: "APPEAL_REVEALING", 10: "APPEAL_COMMITTING",
  11: "READY_TO_FINALIZE", 12: "VALIDATORS_TIMEOUT", 13: "LEADER_TIMEOUT",
};

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function makeClient() {
  return createClient({ chain: studionet });
}

export function makeAccount() {
  return privateKeyToAccount(generatePrivateKey());
}

export function normalizeStatus(tx) {
  if (tx == null) return "UNKNOWN";
  if (typeof tx.statusName === "string") return tx.statusName;
  if (typeof tx.status === "string") return tx.status;
  if (typeof tx.status === "number") return STATUS_NAME[tx.status] ?? `STATUS_${tx.status}`;
  return "UNKNOWN";
}

export function executionOf(tx) {
  if (!tx) return "UNKNOWN";
  if (typeof tx.txExecutionResultName === "string") return tx.txExecutionResultName;
  const lr = tx.consensus_data?.leader_receipt?.[0];
  if (lr) {
    if (typeof lr.execution_result === "string") return lr.execution_result;
    if (typeof lr.result === "string") return lr.result;
    if (lr.result && typeof lr.result === "object") return JSON.stringify(lr.result).slice(0, 400);
  }
  if (typeof tx.resultName === "string") return tx.resultName;
  return "UNKNOWN";
}

export function errorCodeOf(tx) {
  const lr = tx.consensus_data?.leader_receipt?.[0];
  if (!lr) return "";
  const hay = JSON.stringify(lr).slice(0, 2000);
  const m = hay.match(/"payload"\s*:\s*"([A-Z_]+)"/) || hay.match(/\b([A-Z]{3,30}_[A-Z_]{2,30})\b/);
  return m ? m[1] : "";
}

// Poll a known tx hash until FINALIZED, retrying through transient
// HTML/RPC errors (polling a known hash is idempotent).
export async function waitFinalized(client, hash, { timeoutMs = 900000, intervalMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const tx = await client.getTransaction({ hash });
      last = tx;
      const status = normalizeStatus(tx);
      if (status === "FINALIZED") return tx;
      if (status === "CANCELED" || status === "VALIDATORS_TIMEOUT" || status === "LEADER_TIMEOUT") return tx;
    } catch (e) {
      // Transient RPC/HTML error: keep polling.
    }
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting FINALIZED for ${hash}; last status: ${last ? normalizeStatus(last) : "none"}`);
}

export async function write(client, account, address, functionName, args) {
  const hash = await client.writeContract({ account, address, functionName, args, value: 0n });
  const receipt = await waitFinalized(client, hash);
  return { hash, receipt, status: normalizeStatus(receipt), execution: executionOf(receipt), errorCode: errorCodeOf(receipt) };
}

export async function read(client, address, functionName, args = []) {
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await client.readContract({ address, functionName, args });
    } catch (e) {
      lastErr = e;
      await sleep(3000);
    }
  }
  throw lastErr;
}

export async function readSpaced(client, address, functionName, args = []) {
  await sleep(2500);
  return read(client, address, functionName, args);
}
