# Drop log — 1 August 2026

How *What Do I Get, 1978* went to Ethereum mainnet, recorded the way
ANALYSIS.md records the measurements: what happened, in order, so it can be
checked or explained later. Times are US eastern.

## The addresses

| | |
|---|---|
| WhatDoIGet1978 (ERC-721) | `0xbf7370c81acf8768953511564246d0afe80c19b5` |
| Glyphs (render data) | `0x10ae7c8d7190e7844857bf55a7503e1b8d0b92eb` |
| Owner / deployer / royalty receiver | `0xDCD064E82499652BF5f132afD293c1B4a2958800` |
| Deploy block | 25661522 |
| Final allowlist root | `0x18c3af808074390cebc88eb35f4fa2009daec72afce1c46a3204d0481f6208cf` (56 wallets) |

## The allowlist

Built up through the day from 1 test address to 56 wallets: seven pasted by
hand, seventeen CryptoFunk NFT holders and one nonzero $FUNKS holder scraped
from cryptofunks.xyz/holders (the Uniswap pair and zero-balance wallets
excluded), twenty-two wallets holding 30+ slonks from slonks.dev/leaderboard,
one ENS name (zlaser.eth, resolved on chain), and stragglers up to minutes
before the root was set. Duplicates across sources collapsed in the build.

Every rebuild ran the same loop: `node script/allowlist.mjs` (which
self-verifies each proof against the root), `forge test --match-test JsProofs`
(which mints for every address on a fork to prove the JS tree and the
contract's verifier agree), then a push so the site's `allowlist.json` and the
on-chain root moved together. The root changed six times; the contract took a
root update twice (once before launch, once for a late addition).

The Sepolia test wallet was deliberately kept on the mainnet list.

## The site

- **/checker** — built in the morning. Wallet connect (EIP-6963) or a pasted
  address; later extended to ENS names with a dependency-free keccak-256 +
  namehash + registry lookup in `src/ens.js`, verified against spec vectors and
  `cast resolve-name`. The verdict is a square in the edition's language: the
  master cut, ON! reversed out of the navy plate, OFF out of the red.
  Re-fetches the list on every check, so additions showed up live all day.
- **/mint** — restored from the July takedown, first dormant with an empty
  `data-contract` and a countdown, then wired to the live contract. Reads
  phase, price and counts from the chain, so it never claimed anything the
  chain disagreed with. The countdown was removed once public opened.
- **/minted** — restored, pointed at the deploy block. The block steps toward
  the poster as claims land: square-root growth to a filled 5x5, then 7 wide
  through 49, 9 wide through 81, 12 wide from there — mint-out sits as the
  12x15 sheet, the poster reassembled. Phones hold 3-4 columns and scroll.

## The timeline

| Time | Event |
|---|---|
| ~1:00 PM | Allowlist work begins; checker built and shipped |
| 2:26 PM | Contracts deployed to mainnet (phase Closed), gas ~0.00027 ETH |
| ~3:30 PM | Root set on chain; site wired to the contract; mint page live |
| ~4:00 PM | `setPhase(1)` — allowlist free claims open, 56 wallets, 1 each |
| ~5:15 PM | dRPC outage takes down the minted page reads (see incidents) |
| 6:01 PM | `setPhase(2)` — public opens at 0.001978 ETH, 3 per wallet; 14 of 56 free claims were taken, the rest expired as announced |

By 6:30 PM: 23 of 180 minted (14 free + 9 paid), 0.0178 ETH in the contract.
OpenSea indexed the collection unprompted; traits and on-chain SVGs render
correctly. Collection edit rights confirmed via the owner wallet.

## Incidents

**dRPC refused requests mid-drop** ("Can't route your request to suitable
provider"), which broke wallet-less reads on both /mint and /minted — both had
a single hardcoded endpoint. Fixed live by measuring which public providers
actually serve our exact `eth_getLogs` range (most cap at 10-50 blocks or gate
archive access) and building an ordered failover: mevblocker, then drpc, with
every log answer cross-checked against `totalMinted()` before it is believed.
The cross-check exists because **flashbots answers the query with an empty
result instead of an error** — a lie that would have rendered as "Nothing
minted yet" on a page with visible mints.

## Accepted risks, decided and recorded

- **Draw manipulation**: a contract minter can precompute its draw and
  revert-retry until it likes the result (cheaper than the proposer attack the
  NatSpec originally described). Reviewed pre-deploy, accepted for an edition
  of same-price variants, disclosed in `_draw`'s NatSpec. Immutable now.
- **Phases are exclusive**: free claims died at `setPhase(2)`. 42 wallets let
  theirs expire. The owner can flip back to phase 1 for a straggler if ever
  warranted.

## Loose ends

- **Etherscan source verification not done** — no API key was provided. Worth
  doing: `forge verify-contract` works after the fact.
- **Contract balance** accrues with each public mint; `withdraw(to)` sweeps it
  to any address, owner only.
- **OpenSea collection page**: description written (795 chars, on the
  clipboard that day); banner/logo upload was in progress in Studio.
- Royalty receiver is the deployer wallet; move it with
  `setRoyalty(receiver, 1978)` if it should live elsewhere.
