# What Do I Get, 1978

180 items, each one square of the Buzzcocks promo poster for
*What Do I Get?* (United Artists **UP 36348**, February 1978), designed by
Malcolm Garrett.

Every parameter is **measured from the source**, not invented. The derivation is
recorded in [ANALYSIS.md](ANALYSIS.md).

## The system

The poster is one hand-cut square, photocopied and pasted down in eight
orientations — four rotations and their mirrors. Every arrow and chevron across
it is emergent, produced by how neighbouring tiles line up; no tile contains
one.

| | |
|---|---|
| the cut | one diagonal, **21.4°**, fitted across 61 of 63 tiles |
| ink share | **54.6%** |
| orientations | **8** — 4 rotations × mirror |
| lexicon | WHAT · DO · I · GET? · BUZZCOCKS · UP 36348 |
| planes | 3 axis-aligned edges of the white region |
| cap height | **0.070** of the tile, inset **0.037** |

Rarity is structural. The shortest plane is too short for `BUZZCOCKS` and
`UP 36348`, so the long words get two placements where the short ones get
three — the collection carries that 3:2 ratio without anyone assigning it.

```
128  blue          8 orientations × 16 word-plane combos
 17  red           one complete word-plane set, plus one exception (below)
 16  inverted      white type on navy
  8  red inverted  white type on red
  7  blank blue
  4  blank red
───
180  no duplicates, asserted at enumeration
```

The red plate issues **17**, not 16, and blank blue **7**, not 8. The poster
uses red `WHAT` on plane B twice — at rot90 and at rot270-mirrored — but a
plate set issues each word-plane combination once. Rather than drop a state
Garrett actually printed, the extra one takes a seat from a blank. Provenance
beat structural tidiness; the rule and its one exception are both recorded.

## Provenance

All **63** tiles of the 1978 poster are identified. They collapse to **42**
distinct states, and the 42 items reproducing them carry the trait
`Provenance: Malcolm Garrett 1978`.

Matching works on two signals: the shape narrows a tile to a 180° pair, then
the type position breaks the tie. That settled 54 tiles. The remaining nine
were read off a contrast-stretched scan by eye — the type there sits in the
corner where the plane A and plane B boxes overlap, so counting ink inside them
ties no matter how the count is refined. Their derivation is written up in
[ANALYSIS.md](ANALYSIS.md).

That the poster repeats states at all is the finding the mint is built on: 63
tiles drawing only 42 distinct states is what random sampling predicts, not
what a designed sequence looks like. Garrett shuffled. So does the contract.

## Running it

```bash
npm run dev         # http://localhost:5173
npm run mint        # rebuild all 180 SVGs + ERC-721 metadata into ./out
npm run provenance  # re-match the edition against the poster scan
```

`server.mjs` mirrors `vercel.json` — clean URLs (`/about` serves `about.html`)
and `404.html` for unmatched routes — so a local URL is the production URL.
`out/` is generated and git-ignored.

## Pages

| | |
|---|---|
| `index.html` | 7 × 9 — the poster's own grid, 63 drawn from the 180 |
| `all.html` | 12 × 15 — the whole collection (0.800 vs 7:9's 0.778) |
| `traits.html` | filter by any facet, sorted by rarity |
| `about.html` | statement, the record, the band, Garrett, the type |
| `404.html` | a random item |

Rarity score is the usual statistical one — for each trait, one over how often
that value occurs, summed — plus a weight that puts every provenance item above
every item without one. That weight is a **declared choice**, not a statistical
result: 42 of 180 is commoner than a Red Inverted plate (8), so on raw frequency
they would not top the list. They rank first because reproducing a state Garrett
printed is the scarce thing about this edition.

## Contract

`contracts/` — Foundry. ERC-721 + ERC-2981, art rendered on chain.

| | |
|---|---|
| supply | 180 |
| allowlist | free, 1 per wallet, merkle proof |
| public | 0.001978 ETH, 3 per wallet |
| royalty | **exactly 1.978%** — `_feeDenominator()` overridden to 100000 |
| art | SVG built in Solidity from precomputed tables, base64 data URI |

The draw is **blind and random**. `artworkOf[tokenId]` is 0 until minted, and
the artwork is picked by a lazy Fisher-Yates shuffle at mint time — no preview,
no sequence to front-run, no duplicates. Seeded from `block.prevrandao`, which
a block proposer can influence; that is documented in the contract and is not
claimed to be VRF-grade.

`script/GenerateData.mjs` builds the Solidity tables by parsing the **actual
SVG output** of `renderItem()` with a regex, rather than re-deriving the
geometry in a second implementation. A differential test then renders all 180
on chain and compares them byte for byte against the JavaScript. The on-chain
art cannot drift from the generator without the test failing.

```bash
cd contracts
node script/GenerateData.mjs   # regenerate Glyphs.sol + RenderData.sol
forge test                     # 21 tests, incl. the 180-item differential
```

## Type

The `buzzcocks` wordmark is **Compacta Regular Italic** (Fred Lambert,
Letraset, 1963), cut and re-spaced by Garrett in 1977 to nest the two Zs,
stored as outlines. The remaining words are **Eurostile Bold Condensed Oblique**
(after Aldo Novarese, Nebiolo, 1962), also stored as outlines — so an item
renders identically anywhere and needs no font file.

## Layout

```
src/master.js      measured constants - the single source of truth
src/glyphs.js      the lexicon as outlines (generated)
src/provenance.js  states present in the 1978 poster (generated)
src/item.js        geometry, enumeration, SVG rendering
src/rarity.js      trait counts and scoring
src/app.js         the poster viewer
src/about.js       the statement, shared by the page and the overlay
src/mint.js        mint page - unreferenced until the drop
src/minted.js      minted gallery - unreferenced until the drop
src/wallet.js      EIP-6963 discovery, raw JSON-RPC

scripts/mint.mjs         renders the edition + metadata
scripts/provenance.mjs   matches the edition against the poster

contracts/src/WhatDoIGet1978.sol   ERC-721, blind draw, on-chain render
contracts/script/GenerateData.mjs  JS art -> Solidity tables
```

## State

Deployed to **Sepolia** and exercised end to end: allowlist, public mint, blind
draw, on-chain render. The mint and minted pages are currently **removed from
the site** — the machinery is proven but the drop is not until 1 August, and a
live mint page pointing at a testnet contract only misleads. `src/mint.js`,
`src/minted.js` and `src/wallet.js` are kept, unreferenced, to be wired back.

Before mainnet:

- a deployer wallet the owner controls
- a real multi-address allowlist run end to end (only a single-address tree has
  been tested, which is degenerate — the proof array is empty)
- Etherscan verification
- a second pair of eyes on the contract while it is still changeable

## Rights

Two things are unresolved and are **not** code problems:

1. **Type rights.** The Eurostile outlines are extracted from a redrawn version
   of a commercial typeface. Outlines derived from a font are a derivative work.
2. **The wordmark.** `buzzcocks` is a band trademark.

The position taken is that this is a reference and a reading rather than a
reproduction — argued at length on the [about page](about.html). That is an
argument, not a clearance.

Unofficial. Not affiliated with or endorsed by Buzzcocks, Malcolm Garrett, or
United Artists.
