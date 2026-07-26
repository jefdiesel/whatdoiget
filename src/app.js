// One view of the collection. The grid comes from the page, so the same script
// drives both:
//
//   index.html   7 x 9   = 63  - the poster's own grid, a draw from the 180
//   all.html     12 x 15 = 180 - the whole collection at once
//
// 12:15 is 0.800 against 7:9's 0.778, a 2.9% difference. Nothing else factors
// 180 anywhere near that ratio: 10x18 is 0.556, 9x20 is 0.450.
//
// Redistribute reshuffles the draw, which is how the original was made: one
// cut, stamped, pasted down at random.

import { enumerateEdition, renderItem, traitsOf } from './item.js';
import { POSTER_STATES } from './provenance.js';

const poster = document.getElementById('poster');
const COLS = Number(poster.dataset.cols);
const ROWS = Number(poster.dataset.rows);

const items = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });
const overlay = document.getElementById('overlay');

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const POSTER_KEYS = new Set(
  POSTER_STATES.map((p) => `${p.rot}|${p.mirror}|${p.word}|${p.plane}|${p.plate}`));

let current = null;

function open(item) {
  current = item;
  document.getElementById('art').innerHTML = renderItem(item);
  document.getElementById('title').textContent = 'What Do I Get, 1978';
  const rows = Object.entries({ Item: `#${item.id}`, ...traitsOf(item) }).map(
    ([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`);
  if (POSTER_KEYS.has(`${item.rot}|${item.mirror}|${item.word}|${item.plane}|${item.plate}`)) {
    rows.push('<div class="row"><dt>Provenance</dt>' +
      '<dd class="prov">Malcolm Garrett 1978</dd></div>');
  }
  document.getElementById('traits').innerHTML = rows.join('');
  overlay.classList.add('on');
}

const close = () => overlay.classList.remove('on');
overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
document.getElementById('close').onclick = close;

// Step through the whole edition in numerical order, not just what is on screen.
const step = (d) => {
  if (!current) return;
  const i = items.findIndex((x) => x.id === current.id);
  open(items[(i + d + items.length) % items.length]);
};
document.getElementById('next').onclick = () => step(1);
document.getElementById('prev').onclick = () => step(-1);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
  if (!overlay.classList.contains('on')) return;
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});

function redistribute() {
  poster.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  poster.style.aspectRatio = `${COLS} / ${ROWS}`;
  const drawn = shuffle(items).slice(0, COLS * ROWS);
  poster.innerHTML = '';
  for (const item of drawn) {
    const fig = document.createElement('figure');
    fig.innerHTML = renderItem(item);
    fig.title = `#${item.id} ${item.word ?? 'BLANK'}`;
    fig.onclick = () => open(item);
    poster.append(fig);
  }
}

document.getElementById('redistribute').onclick = redistribute;
redistribute();
