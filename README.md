# DebateTree

[Open the chamber](https://chuanqili77.github.io/debatetree-genlayer/) · [Contract](https://explorer-studio.genlayer.com/address/0x1cEC1De81f9466C366d3d7782d2eF0c453B43925)

DebateTree is a two-sided debate chamber on GenLayer Stable Studionet (chain ID 61999). A creator opens a debate with a topic and description. Anyone posts arguments FOR or AGAINST, each with an evidence link. GenLayer validators fetch the evidence and judge soundness: SOUND adds 2 to the side total, UNVERIFIED adds 0, and FLAWED subtracts 1 — a flawed argument hurts its own side. The creator closes the debate once at least 2 arguments are assessed; the higher total wins, or the result is a TIE.

## Use the chamber

1. Open the live site and read the current debate without connecting a wallet, or enter another DebateTree contract address and debate ID.
2. Connect any injected EVM wallet on Stable Studionet (61999) to write. Reads need no wallet.
3. Open a new debate with a topic and description. You become its creator and the only one who may close it.
4. Post arguments FOR or AGAINST with a claim, an HTTPS evidence URL, and an optional note. A debate holds up to 32 arguments; a creator holds up to 8 debates.
5. Assess a pending argument. Validators fetch the evidence page and agree on SOUND, UNVERIFIED, or FLAWED, with an exact quote for SOUND and FLAWED. Unreachable evidence leaves the argument pending and assessable again later.
6. Close the debate as its creator once at least 2 arguments are assessed. The winner is the higher total, or TIE.

## Why the penalty matters

Most debate tools only add points for good arguments. DebateTree also subtracts for bad ones: posting a claim your evidence contradicts costs your side 1 point. That makes posting discipline part of the game — a weak argument for your side is worse than silence, and the scoreboard shows it.

## Trust boundaries

- A verdict records the evidence judgment at assessment time. A later change to the evidence page does not rewrite history.
- Unreachable evidence is fail-closed: the argument stays pending and nothing changes.
- Validators judge whether the evidence page supports the claim. They do not verify real-world truth beyond the page.
- Debate records are public. Use public claims and avoid personal or confidential data.
- All writes transfer zero value. The contract holds no funds.

## Run locally

Node.js 20+ and Python 3.11+:

```sh
npm install
npm test
python3 -m unittest discover -s contract-tests -v
python3 -m unittest discover -s tests_direct -v
npm run build
npm run dev
```

The static output is `frontend/dist/`; relative paths support subdirectory hosting. No paid API key or backend is needed. GenLayerJS 1.1.8 and viem 2.57.8 are pinned.

## Files

- `contracts/debatetree.py` — canonical Intelligent Contract.
- `frontend/src/` — chamber interface (tree view, stage meter, detail panel).
- `contract-tests/`, `tests_direct/` — mocked-host contract checks (separate processes).
- `frontend/tests/` — tree logic checks; `frontend/scripts/check-i18n.mjs` — language key check.
- `scripts/` — Studionet deploy and verification loop.
- `evidence/` — deployment record, loop record, and readback.

MIT licensed.
