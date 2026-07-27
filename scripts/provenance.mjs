// Work out which items of the edition actually appear in the original poster.
//
// Each of the 63 source tiles is matched against every candidate
// (orientation, plane, plate) for its known word, scoring on two things:
//   - how well the ink region overlaps  (IoU on a 27x27 grid)
//   - how close the type sits to where we would set it
// The winning tuples are the ones Malcolm Garrett actually printed in 1978.

import { readFile, writeFile } from 'node:fs/promises';
import { CUT_TOP, CUT_SLOPE } from '../src/master.js';
import { typeAnchor, wordPlaneCombos } from '../src/item.js';

// Same source of truth the edition is enumerated from, so a matched state is
// always a state that actually exists.
const PLANES_FOR = {};
for (const { word, plane } of wordPlaneCombos()) (PLANES_FOR[word] ??= []).push(plane);

const G = 27;
const src = JSON.parse(await readFile(new URL('../compare/source_tiles.json', import.meta.url)));

// ink mask of a given orientation, on the same 27x27 grid
function inkMask(rot, mirror) {
  const m = [];
  for (let j = 0; j < G; j++) {
    const row = [];
    for (let i = 0; i < G; i++) {
      let x = (i + 0.5) / G, y = (j + 0.5) / G;
      // The renderer maps a canonical point p to rot(mirror(p)), so going the
      // other way we must UN-ROTATE FIRST and only then un-mirror.
      for (let k = 0; k < rot; k++) { const nx = y; y = 1 - x; x = nx; }
      if (mirror) x = 1 - x;
      row.push(x < CUT_TOP - CUT_SLOPE * y ? 1 : 0);
    }
    m.push(row);
  }
  return m;
}

const MASKS = {};
for (let rot = 0; rot < 4; rot++)
  for (const mirror of [false, true])
    MASKS[`${rot}${mirror}`] = inkMask(rot, mirror);

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const p = a[j][i], q = b[j][i];
      if (p && q) inter++;
      if (p || q) uni++;
    }
  return uni ? inter / uni : 0;
}

// The nine that the automated type-locator could not settle. Their cuts match
// at 0.929-0.980, so the orientation was never in doubt; what failed was
// isolating a two-letter word from crease and grain at 162px.
//
// Resolved by drawing all three candidate plane boxes over a contrast-stretched
// crop of each tile and reading which one contains the word. In every case it is
// plane B, and the box also confirms the rotation - the 180-degree twin puts the
// word in the opposite corner, where there is nothing.
//
// This is a READ, not a measurement. It is the same method that produced the
// word list, and it is recorded here rather than buried so the basis for each
// of these is checkable against the image.
const READ_BY_EYE = {
  '0,3':  { rot: 3, mirror: true,  plane: 'B' },
  '0,4':  { rot: 0, mirror: false, plane: 'B' },
  '3,1':  { rot: 0, mirror: false, plane: 'B' },
  '3,5':  { rot: 0, mirror: false, plane: 'B' },
  '4,0':  { rot: 2, mirror: true,  plane: 'B' },
  '4,1':  { rot: 3, mirror: true,  plane: 'B' },
  '5,3':  { rot: 2, mirror: true,  plane: 'B' },
  '6,2':  { rot: 2, mirror: true,  plane: 'B' },
  '7,1':  { rot: 0, mirror: true,  plane: 'B' },
};

const matches = [];
for (const t of src) {
  const word = t.word === 'UP36348' ? 'UP 36348' : t.word;
  // The poster has only two plates: plain, and the red one. Inverted and red
  // inverted are variants introduced for the edition and appear nowhere in 1978,
  // so they can never carry provenance.
  const plate = t.red_area > 0.02 ? 'red' : 'standard';

  // The cut has 180-degree symmetry, so shape alone narrows the orientation to
  // a pair. Shape decides first - it is the reliable signal - and the type's
  // position only breaks the remaining tie.
  const shapes = [];
  for (let rot = 0; rot < 4; rot++)
    for (const mirror of [false, true])
      shapes.push({ rot, mirror, shape: iou(MASKS[`${rot}${mirror}`], t.mask) });
  const topShape = Math.max(...shapes.map((s) => s.shape));
  const viable = shapes.filter((s) => s.shape >= topShape - 0.05);

  let best = null;
  for (const { rot, mirror, shape } of viable) {
    for (const plane of PLANES_FOR[word]) {
      const a = typeAnchor({ rot, mirror, word, plane, plate });
      if (!a) continue;
      const d = t.type_centre
        ? Math.hypot(a.cx - t.type_centre[0], a.cy - t.type_centre[1])
        : 1;
      if (!best || d < best.d) best = { rot, mirror, word, plane, plate, shape, d };
    }
  }
  // Only trust a tile we can actually pin down: the cut must match well and the
  // type must land where we would set it.
  let confident = best && best.shape >= 0.88 && best.d <= 0.12 && t.type_centre;

  const eye = READ_BY_EYE[`${t.r},${t.c}`];
  if (!confident && eye) {
    best = { ...eye, word, plate, shape: best ? best.shape : 0, d: 0, byEye: true };
    confident = true;
  }
  matches.push({ r: t.r, c: t.c, ...best, confident });
}

const key = (m) => `${m.rot}|${m.mirror}|${m.word}|${m.plane}|${m.plate}`;
const seen = new Map();
for (const m of matches) if (m.confident && !seen.has(key(m))) seen.set(key(m), m);

const shapes = matches.map((m) => m.shape);
const dists = matches.map((m) => m.d);
if (process.env.DEBUG) {
  const bad = matches.filter((m) => !m.confident);
  console.log(`\n  ${bad.length} tiles not confident:`);
  for (const m of bad) {
    console.log(`   (${m.r},${m.c}) ${m.word.padEnd(10)} iou ${m.shape.toFixed(3)} d ${m.d.toFixed(3)}` +
      (m.shape < 0.88 ? '  <- shape' : '') + (m.d > 0.12 ? '  <- type offset' : ''));
  }
  console.log();
  for (const m of matches.slice(0, 14)) {
    const t = src.find((s) => s.r === m.r && s.c === m.c);
    console.log(`  (${m.r},${m.c}) ${m.word.padEnd(10)} plane${m.plane} rot${m.rot*90}${m.mirror?'M':' '}`,
      `iou ${m.shape.toFixed(3)} d ${m.d.toFixed(3)}`,
      `src[${t.type_centre?.map(v=>v.toFixed(2)).join(',')}]`);
  }
}
console.log(`matched 63 source tiles`);
console.log(`  shape IoU   median ${median(shapes).toFixed(3)}  min ${Math.min(...shapes).toFixed(3)}`);
console.log(`  type offset median ${median(dists).toFixed(3)}  max ${Math.max(...dists).toFixed(3)}`);
const byEye = matches.filter((m) => m.byEye).length;
console.log(`  confidently identified: ${matches.filter((m) => m.confident).length} / 63 tiles`
  + `  (${matches.filter((m) => m.confident && !m.byEye).length} measured, ${byEye} read from the image)`);
console.log(`  distinct states in the poster: ${seen.size}`);

const byPlate = {};
for (const m of seen.values()) byPlate[m.plate] = (byPlate[m.plate] || 0) + 1;
console.log('  by plate:', byPlate);

await writeFile(new URL('../src/provenance.js', import.meta.url),
  '// The states that actually appear in the 1978 poster, found by matching each\n' +
  '// of its 63 tiles against the edition. Items carrying one of these keys get\n' +
  "// the trait Provenance: 'Malcolm Garrett 1978'.\n" +
  '// Generated by scripts/provenance.mjs - do not edit by hand.\n' +
  'export const IN_POSTER = new Set(' +
  JSON.stringify([...seen.keys()].sort(), null, 1) + ');\n\n' +
  '// The same states as objects, so the edition can issue them deliberately\n' +
  '// rather than leaving them to a shuffle.\n' +
  'export const POSTER_STATES = ' +
  JSON.stringify([...seen.values()].map((m) =>
    ({ rot: m.rot, mirror: m.mirror, word: m.word, plane: m.plane, plate: m.plate })), null, 1) + ';\n');
console.log('\nwrote src/provenance.js');

function median(a) { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }
