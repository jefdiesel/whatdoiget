# Source analysis

Everything in `src/master.js` is measured off the promo poster for
**Buzzcocks — "What Do I Get?", United Artists UP 36348, 1978**, designed by
Malcolm Garrett. Nothing is invented. This file records how each number was
obtained so it can be checked or redone.

> Note: the source is the **promo poster / advert**, not the 7" front sleeve —
> the sleeve itself carries no song title. The poster does, in its bottom banner.

## Method

Pixels were classified into three plates (ink / paper / red) by hue and
luminance, then measured. Scripts are throwaway; the numbers are what matter.

## Grid

| | |
|---|---|
| tile pitch | **161.5 px, square** (both axes agreed independently) |
| field | **7 columns × 9 rows = 63 tiles** |
| top row | slightly cropped in the scan |
| banner | ~81 px strip below the field |

Pitch was found by scoring candidate (period, offset) lattices against colour-
transition energy. Vertical and horizontal agreed to within 0.5 px, which is
what confirms the tiles are square.

## The master cut

All 63 tiles are **one square**, stamped. Fitting a straight line to the
ink/paper boundary of each tile:

| | |
|---|---|
| slope, folded over the 8 symmetries | **\|dx/dy\| = 0.3926 ± 0.0111** (n=61) |
| angle to the tile edge | **21.4°** |
| ink share | **54.6%** (paper 45.4%) |

A single diagonal, not a band. Every arrow, chevron and pinwheel visible in the
poster is **emergent** from how neighbouring tiles' cuts line up — no tile
contains one.

Cross-check: matching every tile against a single reference under the 8
symmetries of a square gives **median agreement 0.97, minimum 0.93, 63/63**.

## Orientation — mirroring is real

Measuring each tile's cut angle gives **four** clusters: ~22°, ~69°, ~112°,
~159°.

Rotation alone maps φ → φ+90, so it can only ever produce **two** distinct
angles. The other two (159° = 180−22, 69° = 180−112) can only come from a
reflection. So the stamp uses all **8 orientations** (4 rotations × mirror).

Because the cut has 180° rotational symmetry, those 8 orientations collapse to
only **4 visible angles** — the word is what distinguishes the pairs.

## Type was set separately

No word anywhere in the poster reads backwards, yet the shape is mirrored. Both
can only be true if the type was **not part of the stamped square** — it was set
separately (Letraset) and pasted on top. This is why the generator never mirrors
glyphs and never sets them upside down.

## Words

**Exactly one word per tile, 63/63, no blanks.** Lexicon is six items — the song
title atomised, plus band and catalogue number:

| word | count | share |
|---|---|---|
| BUZZCOCKS | 13 | 20.6% |
| WHAT | 12 | 19.0% |
| UP 36348 | 10 | 15.9% |
| GET? | 10 | 15.9% |
| DO | 9 | 14.3% |
| I | 9 | 14.3% |

Near uniform. `BUZZCOCKS` is Garrett's wordmark, made in 1977 for the
*Orgasm Addict* single: **Compacta Regular Italic** Letraset, sliced and
re-spaced by hand to nest the two Zs.

## Planes

The white region is a quadrilateral. Type aligns to one of its three
**axis-aligned** edges — never the diagonal; the poster contains no angled type.

| plane | edge | length |
|---|---|---|
| A | right | 1.000 |
| B | bottom | 0.650 |
| C | top | **0.258** |

### Inset

Measured across the 62 legible tiles, as a fraction of the tile:

| | |
|---|---|
| nearest edge of the corner | **0.031** |
| second edge | **0.049** |
| median | **0.037** |

### Justification

Type is set into the **corner, away from the cut** — so it ranges left when its
region lies left of the cut and right when it lies right. Implemented as: of the
two ends of the plane, the one further from the diagonal wins. Inset is 0.037 of
the tile, the measured median.

Reading direction is top, left or right — **never upside down**, and never
mirrored, because the type was pasted on rather than stamped.

### Type size

Read off the source against a 5% grid, on tiles (2,6) and (0,6):

| | |
|---|---|
| cap height | **0.070 of the tile**, the same for every word |
| `WHAT` | 0.130 wide over 4 characters -> **0.0325 per character** |
| `BUZZCOCKS` | **0.380** — the wordmark is set wider than the plain words |

Which gives, against plane C at 0.2577:

| word | width | plane C |
|---|---|---|
| I | 0.0325 | fits |
| DO | 0.0650 | fits |
| WHAT / GET? | 0.1300 | fits |
| **UP 36348** | **0.2597** | **misses by 0.002** |
| **BUZZCOCKS** | **0.3800** | misses |

**This is where the 3:2 rarity split comes from**, and it is not tuned. Sweeping
cap height against the real geometry in all eight orientations, at the measured
inset of 0.037:

| cap height | combos | |
|---|---|---|
| ≤ 0.068 | 17 | `BUZZCOCKS` still fits plane C — no split |
| **0.070–0.072** | **16** | the 4×3 + 2×2 split |
| ≥ 0.076 | 15 | `WHAT` falls off plane C too |

The source measures **0.070**, which lands inside that window. So the measured
cap height and the measured inset produce the split on their own.

## Plates

| | measured |
|---|---|
| red | 6 / 63 tiles = **9.5%** (5.06% of poster area) |
| red replaces | the **ink** region — never the paper |
| inverted (white type reversed out of navy) | ~10% of words |

## The master is not dupe-free

Its 63 tiles collapse to **40 distinct** (orientation, word, red) states — 23
collisions. `rot0 · BUZZCOCKS · no red` appears **5 times**, at grid positions
(1,3) (2,6) (4,4) (5,1) (8,2), and those five are pixel-comparable apart from
paper grain.

Drawing 63 times from a 96-state bag predicts ~46 distinct; 40 observed. The
artist shuffled and pasted at random. **The 63 tiles are a sample, not the
vocabulary.**

## Edition

The full vocabulary, extrapolated:

```
8 orientations × 16 word-plane combos          = 128   blue
                one complete word-plane set    =  16   red
                one complete word-plane set    =  16   inverted (white on navy)
                half a word-plane set          =   8   red inverted (white on red)
                all 8 orientations, no type    =   8   blank blue
                4 of 8 orientations, no type   =   4   blank red
                                                 ───
                                                 180
```

Resulting distribution, with the source's ratios preserved:

| plate | count | share | source |
|---|---|---|---|
| blue | 136 | 75.6% | — |
| red | 20 | 11.1% | 9.5% |
| inverted | 16 | 8.9% | ~10% |
| red inverted | 8 | 4.4% | — |

| word | count | share |
|---|---|---|
| DO / GET? | 32 each | 17.8% |
| WHAT / I | 31 each | 17.2% |
| BUZZCOCKS / UP 36348 | 21 each | 11.7% |
| blank | 12 | 6.7% |

Short : long holds at roughly **3:2**. No duplicates — asserted at enumeration.

## The wordmark

`BUZZCOCKS` is never set as text. It is the band's own logo — Compacta Regular
Italic, cut and re-spaced by Malcolm Garrett to nest the two Zs — traced from the artwork into
**12 contours / 242 points**. The other five words are true outlines pulled from
Eurostile Bold Condensed Oblique. All six live in `src/glyphs.js`, so an item
renders identically anywhere and needs no font file.

The type's ink extent is recorded per word, not assumed: the wordmark's Z rises
to **1.171 cap heights**, and treating it as if it stopped at the cap line
clipped it off the tile edge.

## Provenance

Each of the poster's 63 tiles was matched back against the edition — shape first
(the cut has 180° rotational symmetry, so shape narrows the orientation to a
pair), then the type's position to break the tie.

| | |
|---|---|
| confidently identified | **54 of 63** tiles |
| distinct states among them | **36** |
| shape agreement | median 0.975, min 0.922 |

Those 36 items carry the trait `Provenance: Malcolm Garrett 1978`.

### The nine that were not identified

| tile | word | cut match | type offset |
|---|---|---|---|
| (0,3) | DO | 0.966 | 0.860 |
| (0,4) | I | 0.985 | 0.306 |
| (3,1) | I | 0.945 | 0.923 |
| (3,5) | DO | 0.995 | 0.684 |
| (4,0) | DO | 0.926 | 0.891 |
| (4,1) | WHAT | 0.960 | 1.000 |
| (5,3) | I | 0.973 | 0.913 |
| (6,2) | DO | 0.966 | 0.945 |
| (7,1) | WHAT | 0.993 | 0.204 |

Every one matches the cut almost perfectly — IoU 0.926 to 0.995. What fails is
the type: how far it sits from where the model would place it, against a
threshold of 0.12.

And they are all `DO`, `I` and `WHAT` — the three shortest words. An `I` is a
single narrow bar; at 162px that is a handful of dark pixels, and on a creased
or foxed tile the detector grabs damage instead of a letter. So the poster is
fully readable as geometry and only mostly readable as type. These nine are
refused rather than guessed, which is the only thing that makes the other 36
worth stating.

## On chain

The artwork is rendered by the contract, not stored as an image. Solidity has no
floats, so no geometry is derived at runtime: every render parameter is
extracted from the JavaScript renderer's actual output by
`contracts/script/GenerateData.mjs` and only concatenated on chain.

A differential test compares the **full SVG string for all 180 tokens** against
the renderer this site uses — not a sample, not a hash. Change the JavaScript
and the test fails until the table is regenerated, so the on-chain art cannot
drift from the site.

| | |
|---|---|
| Glyphs contract | 14,103 bytes |
| Minter | 16,527 bytes |
| both under EIP-170 | 24,576 bytes |
| whole edition | 379 KB of SVG, mean 2,154 B per item |
