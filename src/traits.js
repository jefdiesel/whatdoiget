// The trait browser: filter the edition by any facet, sorted by rarity.

import { renderItem, traitsOf } from './item.js';
import { buildEdition, FACETS, pct } from './rarity.js';
import { POSTER_STATES } from './provenance.js';

const { ranked, counts, total } = buildEdition();
const active = {};                 // facet -> Set of selected values
for (const f of FACETS) active[f] = new Set();

const el = (id) => document.getElementById(id);
let sort = 'rarity';

// --- filters ----------------------------------------------------------------

function renderFilters() {
  const box = el('filters');
  box.innerHTML = '';
  for (const facet of FACETS) {
    const values = Object.entries(counts[facet]).sort((a, b) => a[1] - b[1]);
    const group = document.createElement('div');
    group.className = 'facet';
    group.innerHTML = `<h3>${facet}</h3>`;
    for (const [value, n] of values) {
      const on = active[facet].has(value);
      const b = document.createElement('button');
      b.className = `chip${on ? ' on' : ''}`;
      b.innerHTML = `<span>${value}</span><em>${n} · ${pct(n, total)}</em>`;
      b.onclick = () => {
        if (on) active[facet].delete(value); else active[facet].add(value);
        renderFilters();
        renderGrid();
      };
      group.append(b);
    }
    box.append(group);
  }
}

function matches(row) {
  return FACETS.every((f) => active[f].size === 0 || active[f].has(row.traits[f]));
}

// --- grid -------------------------------------------------------------------

function renderGrid() {
  const shown = ranked.filter(matches);
  const ordered = sort === 'rarity' ? shown : [...shown].sort((a, b) => a.id - b.id);

  el('count').textContent = active && Object.values(active).some((s) => s.size)
    ? `${ordered.length} of ${total}`
    : `${total} items`;

  const grid = el('grid');
  grid.innerHTML = '';
  for (const row of ordered) {
    const fig = document.createElement('figure');
    fig.innerHTML = renderItem(row.item)
      + `<figcaption><b>#${row.id}</b> <span>rank ${row.rank}</span>`
      + (row.provenance ? '<i class="prov">1978</i>' : '') + '</figcaption>';
    fig.onclick = () => open(row);
    grid.append(fig);
  }
  if (!ordered.length) {
    grid.innerHTML = '<p class="note">Nothing matches that combination.</p>';
  }
}

// --- item overlay -----------------------------------------------------------

function open(row) {
  el('art').innerHTML = renderItem(row.item);
  el('title').textContent = 'What Do I Get, 1978';

  const rows = [
    ['Item', `#${row.id}`],
    ['Rarity rank', `${row.rank} of ${total}`],
    ['Score', row.score.toFixed(1)],
  ];
  let html = rows.map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  for (const f of FACETS) {
    const v = row.traits[f];
    if (f === 'Provenance' && v === 'None') continue;
    const n = counts[f][v];
    html += `<div class="row"><dt>${f}</dt>`
      + `<dd${f === 'Provenance' ? ' class="prov"' : ''}>${v}`
      + `<em>${pct(n, total)}</em></dd></div>`;
  }
  el('traits').innerHTML = html;
  el('overlay').classList.add('on');
}

const close = () => el('overlay').classList.remove('on');
el('overlay').addEventListener('click', (e) => {
  if (e.target === el('overlay') || e.target.classList.contains('inner')) close();
});
el('close').onclick = close;
addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

el('clear').onclick = () => {
  for (const f of FACETS) active[f].clear();
  renderFilters();
  renderGrid();
};
el('sort').onchange = (e) => { sort = e.target.value; renderGrid(); };

renderFilters();
renderGrid();
