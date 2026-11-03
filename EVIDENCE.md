# DebateTree — Evidence

Network: Stable Studionet (chain ID 61999), RPC `https://studio.genlayer.com/api`.
Protocol: `debatetree-1`. Source: `contracts/debatetree.py`.

## Deployment

- Contract address: `0x1cEC1De81f9466C366d3d7782d2eF0c453B43925`
- Explorer: https://explorer-studio.genlayer.com/address/0x1cEC1De81f9466C366d3d7782d2eF0c453B43925
- Deploy transaction: `0xf809a2e2554aeb9ae477018a7593b35a0f83958a8af77ad721b797f9c29deb3f`
- Deploy status: FINALIZED, execution SUCCESS.
- Source SHA-256 (deployed source matches the repository file exactly): `b1f312657d48a6678b78be9c84cea5498ff34a9100c2695be5720d028f65b1df`
- Deployer (loop test account, key held in memory only during the loop): `0x5311D25d131df7F37dA0211eEb72D0B2e0222697`

## Mechanism

A debate is a proposition with two competing sides. Anyone can create a debate
(up to 8 per creator). Anyone can post an argument to an OPEN debate on the FOR
or AGAINST side (up to 32 arguments per debate), citing an HTTPS evidence URL.
Anyone can request assessment of a PENDING argument: validators fetch the
evidence page and agree a verdict. SOUND adds +2 to the argument side total,
UNVERIFIED adds 0, FLAWED subtracts 1 from its own side — a flawed argument
hurts the side that posted it. Evidence that cannot be fetched fails closed:
the transaction errors and the argument stays PENDING. The debate creator can
close an OPEN debate once at least 2 arguments are assessed; the winner is the
side with the higher total, or TIE. See `MECHANISM.md` for bounds and the full
guard list.

## Verification loop

28 steps, all FINALIZED: 20 SUCCESS, 8 ERROR. Every ERROR is an expected guard
proof (the transaction finalized, the guard rejected the call, state unchanged).
Loop accounts (script-operated, keys held in memory only during the loop):
creator `0x9C13B6Db9aaee43C4562480824A91F7BF56692E2`,
alice `0xB0970E8b90613355e255A9915f6421Ced6439f89`,
bob `0xeD33F86B71a2B57A99Aa07a4E571fB7fA7Ceab26`,
carol `0x8A1ae6a9301C51aaC6f6a0567BacEEb975cDD596`.
All loop transactions are zero-value.

| Step | Transaction | Outcome |
| --- | --- | --- |
| create-debate-0 | `0xd6fa78c624652f21098fc012a1bdf2770ea4d30ee31ebe62ecb9a38bc82c2622` | FINALIZED / SUCCESS |
| post-arg-0-FOR-SOUND | `0x8f634c6d4377957ec74d502e077f3ab53c0d210eb8ace4af8cd3a3b569749867` | FINALIZED / SUCCESS |
| post-arg-1-FOR-UNVERIFIED | `0x224614a0a9d4d17752a6a47bfeb29c6247c89a76ba76f7d334a3aafd372d79f5` | FINALIZED / SUCCESS |
| post-arg-2-AGAINST-FLAWED | `0xfd60ce2b5898d05dcf018c20beec709de1a9b61312b6a3914746b938f383e233` | FINALIZED / SUCCESS |
| post-arg-3-AGAINST-SOUND | `0x295a3b58eb3fa52331955acda787f3c8f5cda4ef2093a48716211eec84eeb06e` | FINALIZED / SUCCESS |
| post-arg-4-FOR-UNREACHABLE | `0x0f107848fdc83e18f0d88d498029acab18d92b0977722107fb13681b7f5100bf` | FINALIZED / SUCCESS |
| assess-arg-0 | `0x2b2d9c16ceb149620d3dc69e7d896d658ab0b3f5d1299e063be88ddf63d687e2` | FINALIZED / SUCCESS |
| assess-arg-1 | `0x6fd523ef304922fa2b63973c130d716dc3e3b68088b5ff714d28760fdcca531d` | FINALIZED / SUCCESS |
| assess-arg-2 | `0x8808ed10a79117e23aa4a4c33acba1c58aa34adbc41c472f231b9b42113698c9` | FINALIZED / SUCCESS |
| assess-arg-3 | `0x5b0ecba9f583d71fccc1d80b94d82023eb57cdfbae8079ee709cc04b4e127c1f` | FINALIZED / SUCCESS |
| assess-arg-4-unreachable | `0x27367842e4193785b1c26eda8d82ba52c6e646df97286bdd37d40ed90520d768` | FINALIZED / ERROR / EVIDENCE_UNREACHABLE |
| create-debate-1 | `0xa406752abdf1e3a97ed3dac24895f6b797b1f85c68e0f639bb4b56c0df6b2da4` | FINALIZED / SUCCESS |
| post-arg-5-debate-1 | `0x0eb3b422e65c21260fca4c938003664e6ae46903a7c6558400a5b629e85b02f9` | FINALIZED / SUCCESS |
| assess-arg-5 | `0x48454d95cbc034c77889360ee181b020d974b4becd54b519360ac1a07de09939` | FINALIZED / SUCCESS |
| close-debate-1-too-early | `0x958721ed81599741b6e169a10c38b1d6aaa7cb6409dffe65ff2a4130d3947d7b` | FINALIZED / ERROR / INVALID_STATUS |
| close-debate-0 | `0x3ecab7a3ce1be4b7224bee0bf18d01a4a023a0ae1d71a5b6c9386c38e0e00868` | FINALIZED / SUCCESS |
| assess-closed-debate-pending-arg | `0x4e6e1466a7f8fdeb21f569c0095937c944b70f74e3e5fe1d27c702e171bd1964` | FINALIZED / ERROR / ALREADY_CLOSED |
| post-to-closed-debate | `0x5deb3abffa800a730484344cf4c9ec3d1013ccb1fa73a0cd0c9e2bfc426616c1` | FINALIZED / ERROR / ALREADY_CLOSED |
| close-debate-0-again | `0x47d79819bc49e98d82a39c5e59edb6bbe2c63e975e83e5c588c7cf0675d45376` | FINALIZED / ERROR / ALREADY_CLOSED |
| close-debate-1-by-nonauthor | `0x206920e73c18edc744eb22330a5a8f1d9db7fb2eb667d7592bae34247ebd5814` | FINALIZED / ERROR / UNAUTHORIZED |
| post-bad-side | `0xbaf4319d6dc120a3d66ed307faabd98db0f8c30c81012f3a86fa5a6e0190468f` | FINALIZED / ERROR / INVALID_SIDE |
| create-debate-2 | `0xe700525a913986028093fb52e021688f677d299491d0b17d2b9f096ee1ccf1f9` | FINALIZED / SUCCESS |
| create-debate-3 | `0xd1a5fd7e2cecba725608c95149115d040bf66c835246f2b6004ae2b7e1177702` | FINALIZED / SUCCESS |
| create-debate-4 | `0xf7dc9546f3a60eeb3822c6a61e7878eed401070eaa23e0d688c86d1190c574b4` | FINALIZED / SUCCESS |
| create-debate-5 | `0x01962f07daa46c567a4a8e1521d70b31c45351aa9760369e4630ce8cae470d96` | FINALIZED / SUCCESS |
| create-debate-6 | `0xa6b9abf76983496261775a25b98aa8416ed8578ed8f22b2c2957b3bacdd98eaf` | FINALIZED / SUCCESS |
| create-debate-7 | `0xf9399ae1bbf24e956b76c7b1735f0d58b925bab1a3b3909e80604d23bbe61928` | FINALIZED / SUCCESS |
| create-debate-9-cap | `0x45323e160050174ccd8da7ad7ba73d3b60e68fb82880f2ff436e0fad1e159104` | FINALIZED / ERROR / DEBATE_CAP |

## What the loop proves

- debate-0 created, then 5 arguments posted across both sides (3 FOR, 2 AGAINST).
- Assessments covered all three verdicts: arg-0 SOUND (+2), arg-1 FLAWED (−1),
  arg-2 FLAWED (−1), arg-3 UNVERIFIED (0), arg-5 SOUND (+2).
- The penalty is visible in the side totals: debate-0 closed with FOR 1
  (2 − 1) against AGAINST −1 (0 − 1) — the AGAINST side was dragged below zero
  by its own flawed argument. Winner: FOR.
- arg-4, citing a nonexistent evidence page, failed assessment with
  EVIDENCE_UNREACHABLE and stayed PENDING; it remains PENDING in the closed
  debate, and assessing it after close fails with ALREADY_CLOSED.
- Guard proofs: close with 1 assessed argument fails INVALID_STATUS; close by
  a non-creator fails UNAUTHORIZED; post to a closed debate, assess in a
  closed debate, and re-close all fail ALREADY_CLOSED; a NEUTRAL side fails
  INVALID_SIDE; a 9th debate by the creator fails DEBATE_CAP.
- Final counts: 8 debates, 6 arguments, 5 assessed, 1 closed. debate-1 stays
  OPEN with 1 assessed argument (FOR total 2).

## Verdict note

The consensus verdicts recorded above are the verdicts validators agreed, not
predictions. Two differed from the loop author prior expectations: arg-1
(a claim attributing to the evidence page a statement the page does not make)
came back FLAWED rather than UNVERIFIED, and arg-3 (a claim close to the
page wording) came back UNVERIFIED rather than SOUND. The contract applies
whatever verdict validators agree; borderline claims can resolve either way,
which is the mechanism working as designed.

## Independent readback

A separate client re-read debate-0, debate-1, the counts, and arguments arg-0
through arg-5 and compared every field against the loop final state. Result:
all fields match, 0 mismatches. Record: `evidence/readback.json`.

## Attempt log

- Deployment attempt 1: SUCCESS (transaction above). No failed deployments
  for this contract.
- Loop: single run, 28 steps, no re-runs, no repeated transactions.

## Scope

- All evidence transactions are zero-value test transactions on Studionet.
- Evidence URLs in the loop are public example.com pages; the unreachable
  case cites a nonexistent example.com path.
- The contract validation tooling in the build environment was the static
  rule checker `scripts/check_contract.py` plus acceptance by the network
  schema generator and runner at deploy (the standalone genvm-lint binary was
  not available in the build sandbox).
- The production bundle contains three case-insensitive matches for the string
  "metamask", all inside genlayer-js/viem library code: two thrown-error
  strings ("MetaMask is not installed.") in library client-factory branches
  and the `metamaskClient` API identifier. None of it is user-facing text:
  the frontend checks for an injected provider first and shows its own
  generic message naming no wallet brand, and it calls the generic provider
  path only. The exact phrase "Install MetaMask" appears nowhere in the
  frontend sources, page, or bundle.
- The frontend wallet path uses the generic injected EVM provider; no
  wallet-specific plugin is required to connect, read, or write.
