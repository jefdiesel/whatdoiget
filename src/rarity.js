// Rarity scoring and trait counts, derived from the edition itself.
//
// The score is the usual statistical one: for each trait, one over how often
// that value occurs, summed. A value held by 8 items contributes far more than
// one held by 136.
//
// Provenance is then weighted so those items rank first. Say plainly what that
// is: a DELIBERATE weighting, not something the statistics produce on their own.
// 36 of 180 carry provenance, which is commoner than a Red Inverted plate (8),
// so on raw frequency they would not top the list. They rank first because
// reproducing a state Garrett actually printed in 1978 is the scarce thing about
// this edition, and the score is built to say so.

import { enumerateEdition, traitsOf } from './item.js';
import { POSTER_STATES } from './provenance.js';

const POSTER_KEYS = new Set(
  POSTER_STATES.map((p) => `${p.rot}|${p.mirror}|${p.word}|${p.plane}|${p.plate}`));

export const FACETS = ['Plate', 'Word', 'Plane', 'Rotation', 'Mirror', 'Provenance'];

/// Large enough that every provenance item outranks every one without it.
/// The biggest achievable statistical score is well under this.
const PROVENANCE_WEIGHT = 1000;

export function buildEdition() {
  const items = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });

  const rows = items.map((item) => {
    const t = traitsOf(item);
    const provenance = POSTER_KEYS.has(
      `${item.rot}|${item.mirror}|${item.word}|${item.plane}|${item.plate}`);
    return {
      item,
      id: item.id,
      traits: { ...t, Provenance: provenance ? 'Malcolm Garrett 1978' : 'None' },
      provenance,
    };
  });

  // how often each value occurs
  const counts = {};
  for (const f of FACETS) counts[f] = {};
  for (const r of rows) {
    for (const f of FACETS) {
      const v = r.traits[f];
      counts[f][v] = (counts[f][v] || 0) + 1;
    }
  }

  const total = rows.length;
  for (const r of rows) {
    let score = 0;
    r.contributions = {};
    for (const f of FACETS) {
      if (f === 'Provenance') continue;          // weighted separately, below
      const v = r.traits[f];
      const c = counts[f][v];
      const contribution = total / c;            // = 1 / frequency
      r.contributions[f] = contribution;
      score += contribution;
    }
    if (r.provenance) score += PROVENANCE_WEIGHT;
    r.score = score;
  }

  // rank: highest score first, ties broken by id so the order is stable
  const ranked = [...rows].sort((a, b) => b.score - a.score || a.id - b.id);
  ranked.forEach((r, i) => { r.rank = i + 1; });

  return { rows, ranked, counts, total };
}

export const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`;
