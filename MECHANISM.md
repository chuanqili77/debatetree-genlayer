# DebateTree mechanism

Protocol: `debatetree-1`. Network: GenLayer Stable Studionet, chain ID 61999.

## State

- `debates`: debate ID → record JSON. Fields: protocol, id, creator (lowercase address),
  topic, description, status (OPEN/CLOSED), for_total, against_total, winner ("" until closed),
  argument_ids (ordered), argument_count, assessed_count.
- `arguments`: argument ID → record JSON. Fields: id, debate_id, side (FOR/AGAINST), claim,
  evidence_url, note, author (lowercase address), status (PENDING/ASSESSED), verdict
  ("" until assessed), weight (0 until assessed), quote, reason.
- `meta`: counters as strings. Keys: debate_count, argument_count, assessed_count,
  closed_count, creator:<lowercase address> (debates opened by that creator).
- Debate IDs are `debate-<global index>`; argument IDs are `arg-<global index>`.

## Methods

### create_debate(topic, description)

Anyone. Topic 3–120 characters, description 10–1000 characters. Per-creator cap: 8 debates
(`DEBATE_CAP`). Returns the debate record. Status starts OPEN, totals 0, winner "".

### post_argument(debate_id, side, claim, evidence_url, note)

Anyone. Debate must exist (`NOT_FOUND`) and be OPEN (`ALREADY_CLOSED`). Side must be
FOR or AGAINST (`INVALID_SIDE`). Claim 10–500 characters, evidence URL HTTPS and at most
500 characters (`INVALID_URL`), note at most 500 characters (`TEXT_BOUNDS`). Per-debate cap:
32 arguments (`ARGUMENT_CAP`). New arguments start PENDING with verdict "" and weight 0.

### assess_argument(argument_id)

Anyone. Argument must exist (`NOT_FOUND`), its debate must be OPEN (`ALREADY_CLOSED`),
and the argument must be PENDING (`INVALID_STATUS`). Validators fetch the evidence page
as text and judge, with the page treated as data, never instructions:

- SOUND — the page explicitly supports the claim. Weight +2.
- UNVERIFIED — the page was fetched but does not establish the claim. Weight 0.
- FLAWED — the page contradicts the claim or the claim misrepresents the page. Weight −1.
- UNREACHABLE — no usable page text, or the text is an error page. The transaction fails
  with `EVIDENCE_UNREACHABLE`; the argument stays PENDING and can be assessed again.

For SOUND and FLAWED, the verdict carries a 6–400 character quote copied verbatim from the
page (`UNSUPPORTED_QUOTE` otherwise). UNVERIFIED carries an empty quote. Every verdict
carries a reason of 8–400 characters. Leader and validator runs must agree on the verdict;
disagreement fails the transaction and changes nothing. On success, the argument becomes
ASSESSED, the side total moves by the weight, and the debate assessed_count rises by 1.

### close_debate(debate_id)

Creator only (`UNAUTHORIZED`). Debate must be OPEN (`ALREADY_CLOSED`) with at least 2
assessed arguments (`INVALID_STATUS`). Winner: FOR if for_total is higher, AGAINST if
against_total is higher, otherwise TIE. Status becomes CLOSED. Closing changes nothing
else: assessed arguments, totals, and the winner stay readable.

## Views

- `get_debate(debate_id)` → debate record JSON, or "" when missing.
- `get_argument(argument_id)` → argument record JSON, or "" when missing.
- `get_counts()` → `{"argument_count", "assessed_count", "closed_count", "debate_count"}`.
- `get_protocol()` → `"debatetree-1"`.

## Bounds summary

| Item | Bound |
| --- | --- |
| Debates per creator | 8 |
| Arguments per debate | 32 |
| Topic | 3–120 chars |
| Description | 10–1000 chars |
| Claim | 10–500 chars |
| Evidence URL | HTTPS, ≤500 chars |
| Note | ≤500 chars |
| Verdict quote (SOUND/FLAWED) | 6–400 chars, verbatim substring |
| Verdict reason | 8–400 chars |
| Assessed arguments required to close | 2 |

## Error codes

NOT_FOUND, INVALID_SIDE, INVALID_STATUS, ALREADY_CLOSED, UNAUTHORIZED, DEBATE_CAP,
ARGUMENT_CAP, TEXT_BOUNDS, INVALID_URL, INVALID_ID, UNSUPPORTED_QUOTE, INVALID_VERDICT,
EVIDENCE_UNREACHABLE. All guards fail closed: a failed transaction changes no state.
