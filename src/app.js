// The poster: the whole edition as one sheet, read from the chain. The grid
// column count comes from the page, so the same script drives both:
//
//   index.html   the edition in artwork order - the sheet reassembled
//   all.html     the edition redistributed - shuffled, the way it was made
//
// Every tile is a real minted token. Clicking one opens the same detail panel
// the minted page uses: traits, rarity, and the on-chain owner, transaction,
// and marketplace. Redistribute reshuffles the sheet, which is how the original
// was made: one cut, stamped, pasted down at random.

import {
  EDITION, chainConfig, loadMinted, detailHTML, renderItem, artworkOf, isProvenanced,
} from './collection.js';

const poster = document.getElementById('poster');
const COLS = Number(poster.dataset.cols) || 12;
const SHUFFLE_FIRST = poster.dataset.shuffle === 'true';
const cfg = chainConfig();
const overlay = document.getElementById('overlay');
const count = document.getElementById('count');
const setStatus = (t) => { if (count) count.textContent = t; };

let tokens = [];   // every minted token: { tokenId, artwork, owner, tx }
let order = [];     // the tokens in current display order
let current = null;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function paint() {
  poster.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  poster.innerHTML = '';
  for (const token of order) {
    const fig = document.createElement('figure');
    if (isProvenanced(token)) fig.classList.add('prov');
    fig.innerHTML = renderItem(artworkOf(token));
    fig.title = `#${token.tokenId}`;
    fig.onclick = () => open(token);
    poster.append(fig);
  }
}

function open(token) {
  current = token;
  document.getElementById('art').innerHTML = renderItem(artworkOf(token));
  document.getElementById('title').textContent = 'What Do I Get, 1978';
  document.getElementById('traits').innerHTML = detailHTML(token, cfg);
  overlay.classList.add('on');
}

const close = () => overlay.classList.remove('on');
overlay.addEventListener('click', (e) => {
  if (e.target === overlay || e.target.classList.contains('inner')) close();
});
document.getElementById('close').onclick = close;

// Step through the sheet in its current order, wrapping at either end.
const step = (d) => {
  if (!current) return;
  const i = order.findIndex((t) => t.tokenId === current.tokenId);
  if (i < 0) return;
  open(order[(i + d + order.length) % order.length]);
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
  order = shuffle(tokens);
  paint();
}
document.getElementById('redistribute').onclick = redistribute;

// Default order: index reassembles the sheet by artwork; all comes redistributed.
function initialOrder() {
  return SHUFFLE_FIRST
    ? shuffle(tokens)
    : tokens.slice().sort((a, b) => a.artwork - b.artwork);
}

async function boot() {
  setStatus('reading the chain…');
  poster.innerHTML = '';
  try {
    tokens = await loadMinted(cfg);
  } catch (err) {
    const msg = `Could not read the chain: ${err.message}`;
    setStatus(msg);
    if (!count) poster.innerHTML = `<p class="note" style="grid-column:1/-1">${msg}</p>`;
    return;
  }
  setStatus(`${tokens.length} of ${EDITION.length}`);
  order = initialOrder();
  paint();
}

boot();
