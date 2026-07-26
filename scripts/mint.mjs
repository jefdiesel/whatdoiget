// Render the full edition to ./out plus ERC-721 metadata and a rarity report.
import { mkdir, writeFile } from 'node:fs/promises';
import { enumerateEdition, renderItem, traitsOf } from '../src/item.js';
import { IN_POSTER, POSTER_STATES } from '../src/provenance.js';

const out = new URL('../out/', import.meta.url);
await mkdir(out, { recursive: true });

const items = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });
const tally = {};

for (const item of items) {
  await writeFile(new URL(`${item.id}.svg`, out), renderItem(item));
  const t = traitsOf(item);
  // Items whose exact state was printed in the 1978 poster carry its authorship.
  if (IN_POSTER.has(`${item.rot}|${item.mirror}|${item.word}|${item.plane}|${item.plate}`)) {
    t.Provenance = 'Malcolm Garrett 1978';
  }
  await writeFile(new URL(`${item.id}.json`, out), JSON.stringify({
    name: `What Do I Get, 1978 #${item.id}`,
    description:
      'What Do I Get, 1978 - a single item from the Buzzcocks promo poster for "What Do I Get?" ' +
      '(United Artists UP 36348, 1978), designed by Malcolm Garrett. Every parameter is ' +
      'measured from the source: one cut at 21.4 degrees, eight orientations, six words, ' +
      'three planes. 180 items, no duplicates.',
    external_url: 'https://example.invalid/what-do-i-get-1978',
    image: `ipfs://REPLACE/${item.id}.svg`,
    attributes: Object.entries(t).map(([trait_type, value]) => ({ trait_type, value })),
  }, null, 2));

  for (const [k, v] of Object.entries(t)) {
    tally[k] ??= {};
    tally[k][v] = (tally[k][v] || 0) + 1;
  }
}

const N = items.length;
console.log(`\nEDITION OF ${N}  ->  ./out\n`);
for (const [trait, values] of Object.entries(tally)) {
  console.log(trait);
  for (const [v, c] of Object.entries(values).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${v.padEnd(12)} ${String(c).padStart(4)}   ${((c / N) * 100).toFixed(1)}%`);
  }
}
console.log(`\nno duplicates: enforced at enumeration (${N} unique trait tuples)\n`);
