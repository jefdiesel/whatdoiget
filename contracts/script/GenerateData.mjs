// Emits the Solidity render table from src/item.js.
//
// The contract cannot do the geometry: baseline() works in floats and Solidity
// has none. So every render parameter is extracted HERE, from the real rendered
// SVG, and stored as a table the contract only has to concatenate.
//
// It parses renderItem()'s output rather than re-deriving anything, so the
// on-chain art cannot drift from the site by construction: if the JS changes,
// this table changes with it, and the differential test fails until it is
// regenerated.

import { writeFile } from 'node:fs/promises';
import { enumerateEdition, renderItem } from '../../src/item.js';
import { POSTER_STATES } from '../../src/provenance.js';
import { GLYPHS } from '../../src/glyphs.js';
import { LEXICON, INK, PAPER, SPOT } from '../../src/master.js';
import { traitsOf } from '../../src/item.js';

const items = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });
if (items.length !== 180) throw new Error(`expected 180 items, got ${items.length}`);

// --- pull every token apart -------------------------------------------------
const RE = new RegExp(
  '^<svg xmlns="http://www\\.w3\\.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">' +
  '<rect width="1000" height="1000" fill="(#[0-9a-f]{6})"/>' +
  '<polygon points="([^"]+)" fill="(#[0-9a-f]{6})"/>' +
  '<polygon points="([^"]+)" fill="(#[0-9a-f]{6})"/>' +
  '(?:<g transform="translate\\(([-\\d.]+) ([-\\d.]+)\\) rotate\\((\\d+)\\)">' +
  '<g transform="scale\\(([\\d.]+)\\)">' +
  '<path d="(.*)" fill="(#[0-9a-f]{6})" fill-rule="evenodd"/></g></g>)?' +
  '</svg>$'
);

const POSTER_KEYS = new Set(
  POSTER_STATES.map((p) => `${p.rot}|${p.mirror}|${p.word}|${p.plane}|${p.plate}`));

const polyPairs = [];   // unique "<white>|<ink>" point strings
const glyphList = [];   // unique path data, indexed like LEXICON
const rows = [];

for (const item of items) {
  const svg = renderItem(item);
  const m = svg.match(RE);
  if (!m) throw new Error(`token ${item.id}: SVG did not match the expected shape`);

  const [, bg, whitePts, whiteFill, inkPts, inkFill, tx, ty, rot, scale, d, typeFill] = m;
  if (bg !== PAPER || whiteFill !== PAPER) throw new Error(`token ${item.id}: unexpected paper fill`);

  const pairKey = `${whitePts}|${inkPts}`;
  let poly = polyPairs.indexOf(pairKey);
  if (poly < 0) poly = polyPairs.push(pairKey) - 1;

  let glyph = 255, fill = 0, x = 0, y = 0, rotIdx = 0, sc = 0;
  if (d !== undefined) {
    glyph = glyphList.indexOf(d);
    if (glyph < 0) glyph = glyphList.push(d) - 1;
    fill = [INK, PAPER, SPOT].indexOf(typeFill);
    if (fill < 0) throw new Error(`token ${item.id}: unknown type fill ${typeFill}`);
    // x/y carry up to 2dp in the JS output; store hundredths as integers.
    // Compare with a tolerance - 344.66 * 100 is not exactly 34466 in binary
    // floating point, so an exact modulo test gives false failures.
    x = Math.round(Number(tx) * 100);
    y = Math.round(Number(ty) * 100);
    if (Math.abs(Number(tx) * 100 - x) > 1e-6 || Math.abs(Number(ty) * 100 - y) > 1e-6) {
      throw new Error(`token ${item.id}: translate needs more than 2dp (${tx}, ${ty})`);
    }
    if (x < 0 || y < 0) throw new Error(`token ${item.id}: negative translate (${tx}, ${ty})`);
    rotIdx = { 0: 0, 90: 1, 180: 2, 270: 3 }[Number(rot)];
    if (rotIdx === undefined) throw new Error(`token ${item.id}: odd rotation ${rot}`);
    sc = Math.round(Number(scale) * 1e6);
    if (Math.abs(Number(scale) * 1e6 - sc) > 1e-6) {
      throw new Error(`token ${item.id}: scale needs more than 6dp`);
    }
  }

  const t = traitsOf(item);
  const PLATES = ['Blue', 'Red', 'Inverted', 'Red Inverted'];
  const PLANES = ['A', 'B', 'C', 'None'];
  const inPoster = POSTER_KEYS.has(
    `${item.rot}|${item.mirror}|${item.word}|${item.plane}|${item.plate}`);

  rows.push({
    id: item.id,
    attrRot: item.rot,
    attrMirror: item.mirror ? 1 : 0,
    attrWord: item.word === null ? 6 : LEXICON.indexOf(item.word),
    attrPlane: item.plane === null ? 3 : PLANES.indexOf(item.plane),
    attrPlate: PLATES.indexOf(t.Plate),
    attrProv: inPoster ? 1 : 0,
    inkRed: inkFill === SPOT ? 1 : (inkFill === INK ? 0 : null),
    poly, glyph, fill, x, y, rot: rotIdx, sc,
  });
  if (rows.at(-1).inkRed === null) throw new Error(`token ${item.id}: unknown ink fill ${inkFill}`);
}

if (polyPairs.length !== 8) {
  throw new Error(`expected 8 polygon variants (4 rotations x mirror), got ${polyPairs.length}`);
}

// --- emit Solidity ----------------------------------------------------------
const sol = (s) => JSON.stringify(s); // Solidity string literals accept JSON escaping here

const glyphsSol = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Glyphs
/// @notice The six words of the lexicon as SVG outlines, held in their own
///         contract so the minter stays under the EIP-170 code-size limit.
///         BUZZCOCKS is the band's wordmark (Compacta Bold, modified double Z);
///         the rest are Eurostile Bold Condensed Oblique. Generated from
///         src/glyphs.js by script/GenerateData.mjs - do not edit by hand.
contract Glyphs {
    /// @param i index into the lexicon: ${LEXICON.map((w, i) => `${i}=${w}`).join(', ')}
    function path(uint256 i) external pure returns (string memory) {
${glyphList.map((d, i) => `        if (i == ${i}) return ${sol(d)};`).join('\n')}
        revert("bad glyph");
    }
}
`;

const dataSol = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title RenderData
/// @notice Precomputed render parameters for all 180 items. Solidity has no
///         floats, so none of this is derived on chain - it is extracted from
///         the JS renderer's actual output by script/GenerateData.mjs and only
///         concatenated here. Do not edit by hand.
library RenderData {
    uint256 internal constant SUPPLY = ${rows.length};

    /// @notice The eight orientations: 4 rotations x mirror. White polygon.
    function whitePoly(uint256 i) internal pure returns (string memory) {
${polyPairs.map((p, i) => `        if (i == ${i}) return ${sol(p.split('|')[0])};`).join('\n')}
        revert("bad poly");
    }

    /// @notice ...and the ink polygon for the same orientation.
    function inkPoly(uint256 i) internal pure returns (string memory) {
${polyPairs.map((p, i) => `        if (i == ${i}) return ${sol(p.split('|')[1])};`).join('\n')}
        revert("bad poly");
    }

    /// @notice One packed word per token, low bits first:
    ///         poly:3 | inkRed:1 | glyph:8 | fill:2 | rot:2 | x:17 | y:17 | scale:31
    ///         glyph == 255 means the token carries no word.
    function packed(uint256 tokenId) internal pure returns (uint256 p) {
        require(tokenId >= 1 && tokenId <= ${rows.length}, "bad id");
        bytes memory t = TABLE;
        assembly {
            // 12 bytes per row, 1-indexed
            p := shr(160, mload(add(add(t, 32), mul(sub(tokenId, 1), 12))))
        }
    }

    bytes internal constant TABLE = hex"${rows.map(pack).join('')}";

    /// @notice Traits, two bytes per token, low bits first:
    ///         rot:2 | mirror:1 | word:3 | plane:2 | plate:2 | provenance:1
    ///         word == 6 means Blank; plane == 3 means None.
    function traits(uint256 tokenId) internal pure returns (uint256 a) {
        require(tokenId >= 1 && tokenId <= ${rows.length}, "bad id");
        bytes memory t = ATTRS;
        assembly {
            a := shr(240, mload(add(add(t, 32), mul(sub(tokenId, 1), 2))))
        }
    }

    bytes internal constant ATTRS = hex"${rows.map(packAttrs).join('')}";
}

// The packing, for reference:
${rows.slice(0, 3).map((r) => `//   token ${r.id}: poly=${r.poly} red=${r.inkRed} glyph=${r.glyph} fill=${r.fill} rot=${r.rot} x=${r.x} y=${r.y} scale=${r.sc}`).join('\n')}
`;

function pack(r) {
  // 12 bytes = 96 bits: poly 3 | red 1 | glyph 8 | fill 2 | rot 2 | x 17 | y 17 | scale 31 = 81 bits
  const v = (BigInt(r.poly) << 93n)
    | (BigInt(r.inkRed) << 92n)
    | (BigInt(r.glyph) << 84n)
    | (BigInt(r.fill) << 82n)
    | (BigInt(r.rot) << 80n)
    | (BigInt(r.x) << 63n)
    | (BigInt(r.y) << 46n)
    | BigInt(r.sc);
  return v.toString(16).padStart(24, '0');
}

function packAttrs(r) {
  const v = (r.attrRot << 9) | (r.attrMirror << 8) | (r.attrWord << 5)
    | (r.attrPlane << 3) | (r.attrPlate << 1) | r.attrProv;
  return v.toString(16).padStart(4, '0');
}

await writeFile(new URL('../src/Glyphs.sol', import.meta.url), glyphsSol);
await writeFile(new URL('../src/RenderData.sol', import.meta.url), dataSol);

// The expected SVGs, for the differential test to read via vm.readFile.
await writeFile(new URL('../data/expected.txt', import.meta.url),
  items.map((it) => renderItem(it)).join('\n') + '\n');

console.log(`tokens              ${rows.length}`);
console.log(`polygon variants    ${polyPairs.length}`);
console.log(`glyphs              ${glyphList.length}  (${glyphList.reduce((n, d) => n + d.length, 0)} bytes of path data)`);
console.log(`table               ${rows.length * 12} bytes render + ${rows.length * 2} bytes traits`);
console.log(`provenance tokens   ${rows.filter((r) => r.attrProv).length}`);
console.log(`wrote src/Glyphs.sol, src/RenderData.sol, data/expected.txt`);
