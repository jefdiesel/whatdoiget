// Every constant here is MEASURED off the source sleeve
// (Buzzcocks, "What Do I Get?", United Artists UP 36348, 1978).
// Nothing in this file is invented. See ANALYSIS.md for the derivation.

// --- the cut --------------------------------------------------------------
// One straight diagonal across the square. Fitted across 61 of 63 tiles:
// |dx/dy| = 0.3926 +/- 0.0111  ->  21.4 degrees off the tile edge.
export const CUT_SLOPE = 0.3926;

// Ink covers 54.6% of the tile, paper 45.4%. That fixes where the cut sits.
export const INK_SHARE = 0.546;

// Cut endpoints in the unit square, canonical orientation:
// enters the top edge, exits the bottom edge. Left of it is ink, right is paper.
export const CUT_TOP = INK_SHARE + CUT_SLOPE / 2;     // 0.7423
export const CUT_BOTTOM = INK_SHARE - CUT_SLOPE / 2;  // 0.3497

// --- colour ---------------------------------------------------------------
// Sampled from the scan: navy, newsprint cream, vermillion.
export const INK = '#16202b';
export const PAPER = '#ece4d4';
export const SPOT = '#e2482b';

// --- type -----------------------------------------------------------------
// Type is Eurostile Bold Condensed Oblique - the corporate grotesque Garrett
// set this release in - with the BUZZCOCKS wordmark (Compacta Regular Italic,
// nested double Z) as artwork. Both are stored as outlines, so an item
// needs no font file to render and looks identical everywhere.
import { GLYPHS } from './glyphs.js';

// Widths, as multiples of cap height, from the real font metrics:
//   I 0.409   DO 1.436   GET? 2.483   WHAT 3.149   BUZZCOCKS 3.406   UP 36348 5.207
export const CAP_H = 0.070;   // cap height, as a fraction of the tile

// The wordmark is a logo, not a word: the poster sets it at its own size, wider
// than the copy around it. Measured off the source at 0.40 of the tile, against
// 0.238 if it were merely cap-matched to the plain words.
export const WORDMARK_W = 0.400;

export const wordWidth = (w) =>
  w === 'BUZZCOCKS' ? WORDMARK_W : GLYPHS[w].w * CAP_H;

// The 3:2 split depends on this cap height. Sweeping it against the real
// geometry in all eight orientations, at the measured type inset of 0.037:
//   <= 0.068     17 combos - BUZZCOCKS still fits plane C, so no split
//   0.070-0.072  16 combos - the intended 4x3 + 2x2 split
//   >= 0.076     15 combos - WHAT falls off plane C as well
// 0.070 is what the source measures, and it lands inside that window. So the
// split is not something the cap height was tuned to produce: the measured cap
// height and the measured inset give it on their own.

// The lexicon: the song title atomised, plus band and catalogue number.
// Counted in the source at 13/12/10/10/9/9 across 63 tiles - near uniform.
export const LEXICON = ['WHAT', 'DO', 'I', 'GET?', 'BUZZCOCKS', 'UP 36348'];

// --- the three planes -----------------------------------------------------
// The white region is a quadrilateral. Type aligns to one of three of its
// edges. Plane C is only 0.2575 long, so the two long words do not fit it -
// this is what produces the 3:2 rarity split, and it is geometry, not policy.
export const PLANES = ['A', 'B', 'C'];
export const PLANE_C_LENGTH = 1 - CUT_TOP;   // 0.2577

export function planesFor(word) {
  return wordWidth(word) <= PLANE_C_LENGTH ? ['A', 'B', 'C'] : ['A', 'B'];
}

// --- plates ---------------------------------------------------------------
// Measured in the source: 6/63 tiles carry the red plate (9.5%); ~10% of words
// are reversed out white on the navy. Issued at one complete word-plane set each.
export const PLATES = ['standard', 'red', 'inverted'];

// --- orientation ----------------------------------------------------------
// 4 rotations x mirror. Mirroring is real: the band angle takes four distinct
// values (22, 69, 112, 159 degrees), which rotation alone cannot produce.
// The TYPE is never mirrored - it was set separately and pasted on top, which
// is why no word in the source reads backwards.
export const ROTATIONS = [0, 1, 2, 3];
export const MIRRORS = [false, true];
