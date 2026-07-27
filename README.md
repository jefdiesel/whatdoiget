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
 16  red           one complete word-plane set
 16  inverted      white type on navy
  8  red inverted  white type on red
  8  blank blue    all 8 orientations
  4  blank red
───
180  no duplicates, asserted at enumeration
```

**35 items** reproduce a state that appears in the 1978 poster itself and carry
the trait `Provenance: Malcolm Garrett 1978`. They were found by matching each
of the poster's 63 tiles against the edition; 52 of the 63 could be pinned down
confidently, and those collapse to 35 distinct states.

## Running it

```bash
npm run dev      # serve at http://localhost:5173
npm run mint     # rebuild all 180 SVGs + ERC-721 metadata into ./out
```

`out/` is generated and git-ignored — `npm run mint` rebuilds it.

## Pages

| | |
|---|---|
| `index.html` | 7 × 9 — the poster's own grid, 63 drawn from the 180 |
| `all.html` | 12 × 15 — the whole collection (0.800 vs 7:9's 0.778) |
| `about.html` | the record, the band, Garrett, the type |

## Layout

```
src/master.js      measured constants - the single source of truth
src/glyphs.js      the lexicon as outlines (generated)
src/provenance.js  states present in the 1978 poster (generated)
src/item.js        geometry, enumeration, SVG rendering
src/app.js         the viewer
scripts/mint.mjs         renders the edition + metadata
scripts/provenance.mjs   matches the edition against the poster
```

## Type

The `buzzcocks` wordmark is **Compacta Regular Italic** (Fred Lambert,
Letraset, 1963), cut and re-spaced by Garrett in 1977 to nest the two Zs,
stored as outlines. The remaining
words are **Eurostile Bold Condensed Oblique** (after Aldo Novarese, Nebiolo,
1962), also stored as outlines — so an item renders identically anywhere and
needs no font file.

## Before minting

Two things are unresolved and are **not** code problems:

1. **Type rights.** The Eurostile outlines are extracted from a redrawn version
   of a commercial typeface. Outlines derived from a font are a derivative work.
2. **The wordmark.** `buzzcocks` is a band trademark.

Both need a real answer before this is distributed.

Unofficial. Not affiliated with or endorsed by Buzzcocks, Malcolm Garrett, or
United Artists.
