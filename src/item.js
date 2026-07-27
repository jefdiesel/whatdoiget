// Enumerates the edition and renders a single item to SVG.
// A "single item" is one square: the master cut at one orientation, with at
// most one word aligned to one plane, on one of three plates.

import {
  CUT_TOP, CUT_BOTTOM, CUT_SLOPE, INK, PAPER, SPOT, CAP_H, wordWidth,
  LEXICON, PLANES, ROTATIONS, MIRRORS,
} from './master.js';
import { GLYPHS } from './glyphs.js';
import { makeRng } from './rng.js';

const n6 = (v) => (Math.round(v * 1e6) / 1e6).toString();

// --- geometry -------------------------------------------------------------
// Canonical orientation: cut runs top -> bottom, ink to the left of it.
const INK_POLY = [{ x: 0, y: 0 }, { x: CUT_TOP, y: 0 }, { x: CUT_BOTTOM, y: 1 }, { x: 0, y: 1 }];
const WHITE_POLY = [{ x: CUT_TOP, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: CUT_BOTTOM, y: 1 }];
// The cut itself - the centre line the type is always pushed away from.
const CUT_A = { x: CUT_TOP, y: 0 };
const CUT_B = { x: CUT_BOTTOM, y: 1 };

// Type inset from the edges of its corner. Measured across the source's 62
// legible tiles: nearest edge 0.031, second edge 0.049, median 0.037.
const PAD = 0.037;

// The three axis-aligned edges of the white quad. Type is never set on the
// diagonal - the source has no angled type at all. Plane C is the short one
// that the two long words cannot fit; that is what produces the 3:2 split.
const PLANE_EDGES = {
  A: [{ x: 1, y: 0 }, { x: 1, y: 1 }],                 // right,  length 1.000
  B: [{ x: CUT_BOTTOM, y: 1 }, { x: 1, y: 1 }],        // bottom, length 0.650
  C: [{ x: CUT_TOP, y: 0 }, { x: 1, y: 0 }],           // top,    length 0.258
};

// The inverted plate reverses the type out of the navy, so it aligns to the
// ink region's own three axis-aligned edges instead.
const INK_PLANE_EDGES = {
  A: [{ x: 0, y: 0 }, { x: 0, y: 1 }],                 // left,   length 1.000
  B: [{ x: 0, y: 0 }, { x: CUT_TOP, y: 0 }],           // top,    length 0.742
  C: [{ x: 0, y: 1 }, { x: CUT_BOTTOM, y: 1 }],        // bottom, length 0.350
};

// How far a line through p along dir can travel inside a convex polygon.
function spanInPolygon(poly, p, dir) {
  let lo = -Infinity, hi = Infinity;
  const nrm = { x: dir.y, y: -dir.x };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const e = { x: b.x - a.x, y: b.y - a.y };
    // inward normal of this edge, for a polygon wound either way
    let ni = { x: e.y, y: -e.x };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const cen = poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length }), { x: 0, y: 0 });
    if (ni.x * (cen.x - mid.x) + ni.y * (cen.y - mid.y) < 0) ni = { x: -ni.x, y: -ni.y };
    const denom = ni.x * dir.x + ni.y * dir.y;
    const dist = ni.x * (a.x - p.x) + ni.y * (a.y - p.y);
    if (Math.abs(denom) < 1e-9) {
      if (dist > 1e-9) return null;            // parallel and outside
    } else if (denom > 0) {
      lo = Math.max(lo, dist / denom);
    } else {
      hi = Math.min(hi, dist / denom);
    }
  }
  return hi > lo ? [lo, hi] : null;
}

// Build the baseline in WORLD space, from the already-transformed geometry.
// Doing it this way guarantees the type lands inside the white region for every
// one of the eight orientations, which transporting a canonical baseline does not.
function baseline(plane, word, whitePoly, rot, mirror, inverted) {
  const w = wordWidth(word);
  const edges = inverted ? INK_PLANE_EDGES : PLANE_EDGES;
  let [e0, e1] = edges[plane].map((p) => rotPt(mirror ? mirrorPt(p) : p, rot));

  const horizontal = Math.abs(e1.x - e0.x) > Math.abs(e1.y - e0.y);

  // Inward normal of this edge (towards the middle of the region).
  const cen = whitePoly.reduce(
    (s, q) => ({ x: s.x + q.x / whitePoly.length, y: s.y + q.y / whitePoly.length }), { x: 0, y: 0 });
  const mid = { x: (e0.x + e1.x) / 2, y: (e0.y + e1.y) / 2 };
  let N = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
  if (N.x * (cen.x - mid.x) + N.y * (cen.y - mid.y) < 0) N = { x: -N.x, y: -N.y };

  // Reading direction. Type may face top (0), right (90) or left (270) - never
  // upside down. Glyphs grow off the baseline towards local -y, so on a vertical
  // edge we pick the direction that turns them into the region: that is what
  // decides left-facing vs right-facing, rather than it being a free trait.
  let dir, angle;
  if (horizontal) {
    dir = { x: 1, y: 0 };
    angle = 0;
  } else if (N.x > 0) {
    dir = { x: 0, y: 1 };   // region to the right -> reads downward
    angle = 90;
  } else {
    dir = { x: 0, y: -1 };  // region to the left  -> reads upward
    angle = 270;
  }

  // Inset the baseline by the type's REAL ink extent, not by one cap height.
  // The wordmark's Z rises 1.17 cap heights above the baseline, so assuming the
  // cap line clips it straight off the edge of the tile.
  // Scale by the word's OWN render size. The wordmark is set to a fixed width,
  // so its effective cap height is larger than CAP_H and using CAP_H here
  // under-measures its ink and runs it off the tile.
  const g = GLYPHS[word];
  const sc = w / g.w;
  const up = { x: dir.y, y: -dir.x };
  const growsInward = up.x * N.x + up.y * N.y > 0;
  const drop = PAD + (growsInward ? g.bottom : g.top) * sc;
  const p = { x: mid.x + N.x * drop, y: mid.y + N.y * drop };

  const span = spanInPolygon(whitePoly, p, dir);
  if (!span) return null;
  const [lo, hi] = span;
  if (hi - lo < w + PAD) return null;          // will not fit; caller skips

  // Type is pushed into the corner, AWAY from the cut. So it ranges left when
  // its region sits to the left of the cut and right when it sits to the right -
  // whichever end of the plane is further from the diagonal wins.
  const c0 = rotPt(mirror ? mirrorPt(CUT_A) : CUT_A, rot);
  const c1 = rotPt(mirror ? mirrorPt(CUT_B) : CUT_B, rot);
  const cd = { x: c1.x - c0.x, y: c1.y - c0.y };
  const cLen = Math.hypot(cd.x, cd.y) || 1;
  const distToCut = (q) =>
    Math.abs(cd.x * (q.y - c0.y) - cd.y * (q.x - c0.x)) / cLen;

  const at = (t) => ({ x: p.x + dir.x * t, y: p.y + dir.y * t });
  const t = distToCut(at(lo)) > distToCut(at(hi)) ? lo + PAD : hi - PAD - w;
  return { p: at(t), angle, w };
}

function mirrorPt(p) { return { x: 1 - p.x, y: p.y }; }
function mirrorVec(v) { return { x: -v.x, y: v.y }; }
function rotPt(p, k) {
  let { x, y } = p;
  for (let i = 0; i < k; i++) { const nx = 1 - y; y = x; x = nx; }
  return { x, y };
}
function rotVec(v, k) {
  let { x, y } = v;
  for (let i = 0; i < k; i++) { const nx = -y; y = x; x = nx; }
  return { x, y };
}

function transformPoly(poly, rot, mirror) {
  return poly.map((p) => rotPt(mirror ? mirrorPt(p) : p, rot));
}

// --- enumeration ----------------------------------------------------------
// A word/plane pair is only valid if the type actually FITS - tested against the
// real geometry, on both the white region and the ink one, rather than against a
// nominal edge length. Getting this wrong lets an item claim a word in its traits
// and then render without it.
// The usable span is NOT the same in every orientation: on a horizontal edge
// with its region below, the baseline drops a further cap height inward, which
// moves it to a narrower part of the wedge. So test all eight, on both regions.
function fits(word, plane) {
  for (const inverted of [false, true]) {
    for (const mirror of MIRRORS) {
      for (const rot of ROTATIONS) {
        const poly = transformPoly(inverted ? INK_POLY : WHITE_POLY, rot, mirror);
        if (!baseline(plane, word, poly, rot, mirror, inverted)) return false;
      }
    }
  }
  return true;
}

export function wordPlaneCombos() {
  const out = [];
  for (const word of LEXICON)
    for (const plane of PLANES)
      if (fits(word, plane)) out.push({ word, plane });
  return out;
}

// opts.posterFirst is a list of {word, plane, plate} states that appear in the
// 1978 poster. They are issued before anything else on their plate, so an item
// that Garrett actually printed is always represented in the edition rather than
// left out by a shuffle.
export function enumerateEdition(seed = 'UP36348', opts = {}) {
  const rng = makeRng(seed);
  const posterFirst = opts.posterFirst ?? [];
  const items = [];
  const combos = wordPlaneCombos();
  const orients = [];
  for (const mirror of MIRRORS) for (const rot of ROTATIONS) orients.push({ rot, mirror });

  // 1. standard plate: the complete cross-product, 8 x 16 = 128
  for (const o of orients) {
    for (const wp of combos) items.push({ ...o, ...wp, plate: 'standard' });
  }

  // 2 & 3. red and inverted: one complete word-plane set each, spread evenly
  //        over the 8 orientations (16 combos -> 2 per orientation).
  for (const plate of ['red', 'inverted']) {
    const wanted = posterFirst.filter((p) => p.plate === plate);
    const isWanted = (wp) => wanted.some((w) => w.word === wp.word && w.plane === wp.plane);
    const order = [...combos.filter(isWanted), ...rng.shuffle(combos.filter((wp) => !isWanted(wp)))];
    order.forEach((wp, i) => {
      // a poster state keeps its own orientation; the rest spread evenly
      const hist = wanted.find((w) => w.word === wp.word && w.plane === wp.plane);
      const o = hist ? { rot: hist.rot, mirror: hist.mirror } : orients[i % 8];
      items.push({ ...o, ...wp, plate });
    });
  }

  // 4. white type reversed out of the red plate: half a word-plane set, one
  //    per orientation.
  rng.shuffle(combos).slice(0, 8).forEach((wp, i) =>
    items.push({ ...orients[i], ...wp, plate: 'redinv' }));

  // Any poster state still unplaced gets a seat. The plate sets issue each
  // word-plane combo once, so when the poster used the same combo twice at
  // different rotations - red WHAT on plane B, at rot90 and rot270M - only one
  // fits. Provenance is worth more than the tidiness of the set, so the extras
  // are appended and the blank blues give up a seat each to hold 180.
  const key = (x) => `${x.rot}|${x.mirror}|${x.word}|${x.plane}|${x.plate}`;
  const placed = new Set(items.map(key));
  let extras = 0;
  for (const p of posterFirst) {
    if (p.word === null || placed.has(key(p))) continue;
    items.push({ rot: p.rot, mirror: p.mirror, word: p.word, plane: p.plane, plate: p.plate });
    placed.add(key(p));
    extras++;
  }

  // 4. blank blue: one per orientation, less whatever the extras took.
  for (const o of orients.slice(0, orients.length - extras)) {
    items.push({ ...o, word: null, plane: null, plate: 'standard' });
  }

  // 5. blank red: 4 of the 8 possible, drawn at random (deterministically).
  for (const o of rng.shuffle(orients).slice(0, 4)) {
    items.push({ ...o, word: null, plane: null, plate: 'red' });
  }

  // Every worded item must actually render its word. If the geometry cannot
  // place it, the trait would be a lie, so fail loudly here instead.
  for (const it of items) {
    if (it.word && !renderItem({ ...it, id: 0 }).includes('<path')) {
      throw new Error(`item claims word "${it.word}" on plane ${it.plane} but renders none ` +
        `(rot${it.rot * 90}${it.mirror ? 'M' : ''}, ${it.plate})`);
    }
  }

  // stable ids, and a dupe assertion - the whole point of the edition
  const seen = new Set();
  items.forEach((it, i) => {
    const key = `${it.rot}|${it.mirror}|${it.word}|${it.plane}|${it.plate}`;
    if (seen.has(key)) throw new Error(`duplicate item: ${key}`);
    seen.add(key);
    it.id = i + 1;
  });
  return items;
}

// --- rendering ------------------------------------------------------------
const SIZE = 1000;
const n = (v) => (Math.round(v * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The source is set in a heavy condensed oblique grotesque - Compacta Regular
// Italic. Impact is the closest thing present on both macOS and
// Windows; the obliquing is done with skewX, as the original's was.
// NOTE: this stack must be replaced with embedded glyph outlines before mint -
// see README. A font that is merely *referenced* will render differently on
// every viewer's machine, which is not acceptable for a fixed edition.
const FONT = "Impact, Haettenschweiler, 'Arial Narrow', sans-serif";

export function renderItem(item) {
  const { rot, mirror, word, plane, plate } = item;

  const inkColour = plate === 'red' || plate === 'redinv' ? SPOT : INK;
  const inkPts = transformPoly(INK_POLY, rot, mirror);
  const whitePts = transformPoly(WHITE_POLY, rot, mirror);
  const pts = (poly) => poly.map((p) => `${n(p.x * SIZE)},${n(p.y * SIZE)}`).join(' ');

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">`);
  parts.push(defs());
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="${PAPER}"/>`);
  parts.push(`<polygon points="${pts(whitePts)}" fill="${PAPER}"/>`);
  parts.push(`<polygon points="${pts(inkPts)}" fill="${inkColour}"/>`);

  const onInk = plate === 'inverted' || plate === 'redinv';
  if (word) parts.push(renderType(item, onInk ? inkPts : whitePts));

  parts.push(`</svg>`);
  return parts.join('');
}

function renderType(item, typePoly) {
  const { rot, mirror, word, plane, plate } = item;
  const onInk = plate === 'inverted' || plate === 'redinv';
  const bl = baseline(plane, word, typePoly, rot, mirror, onInk);
  if (!bl) return '';
  const { p, angle, w } = bl;

  // reversed-out plates take paper; the red plate prints its type in red
  const fill = onInk ? PAPER : plate === 'red' ? SPOT : INK;

  let out = `<g transform="translate(${n(p.x * SIZE)} ${n(p.y * SIZE)}) rotate(${angle})">`;
  out += setWord(word, w * SIZE, fill);
  return out + `</g>`;
}

// Nothing here is set as text. Each word is the source's own artwork, scaled to
// cap height and dropped onto the baseline, so it renders identically anywhere.
function setWord(word, width, fill) {
  const g = GLYPHS[word];
  // Glyphs are normalised to cap height 1 with the baseline already at y = 0,
  // so placing a word is just a uniform scale.
  const s = width / g.w;
  return `<g transform="scale(${n6(s)})">` +
    `<path d="${g.d}" fill="${fill}" fill-rule="evenodd"/></g>`;
}

function defs() {
  return '';
}

export function traitsOf(item) {
  return {
    Plate: { standard: 'Blue', red: 'Red', inverted: 'Inverted', redinv: 'Red Inverted' }[item.plate],
    Word: item.word ?? 'Blank',
    Plane: item.plane ?? 'None',
    Rotation: `${item.rot * 90}°`,
    Mirror: item.mirror ? 'Mirrored' : 'As Cut',
  };
}

// Where the type lands for a given item, in unit tile coordinates. Used by
// scripts/provenance.mjs to match the edition against the original poster.
export function typeAnchor(item) {
  const onInk = item.plate === 'inverted' || item.plate === 'redinv';
  const poly = transformPoly(onInk ? INK_POLY : WHITE_POLY, item.rot, item.mirror);
  const bl = baseline(item.plane, item.word, poly, item.rot, item.mirror, onInk);
  if (!bl) return null;
  // Centre of the set word. It runs along dir from the baseline start, and the
  // glyphs sit on the local -y side, which in world space is (sin a, -cos a).
  const rad = (bl.angle * Math.PI) / 180;
  const ca = Math.cos(rad), sa = Math.sin(rad);
  return {
    cx: bl.p.x + ca * (bl.w / 2) + sa * (CAP_H / 2),
    cy: bl.p.y + sa * (bl.w / 2) - ca * (CAP_H / 2),
  };
}
