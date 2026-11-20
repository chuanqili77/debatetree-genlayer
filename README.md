# DebateTree V2

[Open the chamber](https://chuanqili77.github.io/debatetree-genlayer/) · [V2 contract](https://explorer-studio.genlayer.com/address/0x75BD17Ae2a210a63b56745Adeff0EddbfA6f725C) · [Changes from the accepted baseline](https://github.com/chuanqili77/debatetree-genlayer/compare/6617bc34830ec8dbabef67d80eb22d2c070777a4...main)

DebateTree is a two-sided debate chamber on GenLayer Stable Studionet (61999). The original chamber records consensus verdicts and awards +2 for SOUND, 0 for UNVERIFIED and −1 for FLAWED. V2 adds an on-chain appeal process with independently reviewed counterevidence, a preserved original ruling, and exactly-once score correction.

## Appeal workflow

1. The author of a FLAWED or UNVERIFIED argument in an open debate may file one appeal with a different HTTPS evidence URL and written grounds.
2. Anyone may submit a review transaction during the 24-hour appeal window. Each validator independently renders the counterevidence, evaluates the original claim and the reason for the initial ruling, verifies literal quotation provenance, and checks verdict agreement. Failed review leaves the appeal pending.
3. Canonical counterevidence supporting the original claim and addressing the earlier deficiency can reverse the ruling to SOUND. The contract adds only the difference between the old and new score. An upheld, withdrawn, or expired appeal adds zero.
4. The author can withdraw before the deadline. Anyone can expire an unresolved appeal at or after the deadline. The debate creator cannot close while any appeal is pending. Resolution preserves the original quote and ruling alongside the review.

## Review the public example

Use the three demo buttons to read the finalized V2 debate without a wallet. They display a corrected schedule, insufficient counterevidence, and an author withdrawal. The library and its published reference pages are intentionally fictional fixtures pinned to an immutable Git commit. The contract calls, validator decisions, transaction hashes, and score readbacks are real.

[Deployment](evidence/deployment-v2.json) · [Finalized V2 transactions and state](evidence/appeals-v2.json) · [V1 archive](https://chuanqili77.github.io/debatetree-genlayer/?legacy=1)

The contract assesses support from the source under review. It does not establish real-world truth or publisher identity, and public pages can change or fail. For repeatable evidence, prefer versioned sources. An author gets one appeal per argument, including after withdrawal or expiry. The 24-hour window starts on filing; debates may close before an appeal is filed. All writes are zero value.

## Verify or develop

Use Node.js 20+ and Python 3.11+.

```sh
npm ci
npm test
python -m unittest discover -s contract-tests
python -m unittest discover -s tests_direct
node scripts/verify-v2.mjs
npm run build
```

`contracts/debatetree.py` is the canonical V2 source. `node scripts/deploy.mjs` creates a fresh V2 deployment. `node scripts/check-v2.mjs` runs a new evidence exercise using temporary wallets on a fresh deployment. For V1, see [historical evidence](EVIDENCE.md), [historical mechanism](MECHANISM.md), and [the accepted source](https://github.com/chuanqili77/debatetree-genlayer/blob/6617bc34830ec8dbabef67d80eb22d2c070777a4/contracts/debatetree.py).

MIT licensed.
