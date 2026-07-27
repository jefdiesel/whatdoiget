// What has actually been minted, read from the chain.
//
// Reads Minted events over JSON-RPC directly rather than through a wallet, so
// the page works for anyone with no connection and no extension. One getLogs
// call covers the whole edition instead of 180 separate reads.

import { enumerateEdition, renderItem, traitsOf } from './item.js';
import { POSTER_STATES } from './provenance.js';
import { buildEdition } from './rarity.js';

const CONTRACT = document.body.dataset.contract || '';
const NETWORK = document.body.dataset.network || 'sepolia';
const FROM_BLOCK = document.body.dataset.fromBlock || '0x0';
// publicnode and 1rpc both refuse a getLogs range this wide (archive-gated, or
// capped at 50 blocks). drpc serves it, so it is the default; override with
// data-rpc on the body if that ever changes.
const RPC = document.body.dataset.rpc || (NETWORK === 'sepolia'
  ? 'https://sepolia.drpc.org'
  : 'https://eth.drpc.org');

// keccak256("Minted(address,uint256,uint256)")
const MINTED_TOPIC = '0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff';

const EDITION = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });
const { ranked } = buildEdition();
const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
// provenance is a property of the item, not a rank cutoff: read it from the
// edition rather than assuming the first N ranks carry it.
const provById = new Map(ranked.map((r) => [r.id, r.provenance]));

const el = (id) => document.getElementById(id);
const explorer = `https://${NETWORK === 'sepolia' ? 'sepolia.' : ''}etherscan.io`;
let minted = [];

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function load() {
  if (!CONTRACT) {
    el('grid').innerHTML = '<p class="note">Not deployed yet.</p>';
    return;
  }
  el('count').textContent = 'reading the chain…';
  try {
    const logs = await rpc('eth_getLogs', [{
      address: CONTRACT,
      topics: [MINTED_TOPIC],
      fromBlock: FROM_BLOCK,
      toBlock: 'latest',
    }]);
    minted = logs.map((l) => ({
      tokenId: Number(BigInt(l.topics[2])),
      artwork: Number(BigInt(l.data)),
      owner: `0x${l.topics[1].slice(26)}`,
      tx: l.transactionHash,
    })).sort((a, b) => a.tokenId - b.tokenId);
  } catch (err) {
    el('count').textContent = '';
    el('grid').innerHTML = `<p class="note">Could not read the chain: ${err.message}</p>`;
    return;
  }
  render();
}

/// Lay the minted items out as a near-square block: 3 across at three, 2x2 at
/// four, 3x2 at six, 3x3 at nine, and so on. Columns are ceil(sqrt(n)), capped
/// by what actually fits the viewport so it keeps working at 180.
function layout(n) {
  const TILE = 210;                       // a comfortable tile at full size
  const fits = Math.max(1, Math.floor((Math.min(innerWidth, 1300) - 44) / 140));
  // up to three sit in a single row; past that, go near-square
  const want = n <= 3 ? n : Math.ceil(Math.sqrt(n));
  const cols = Math.max(1, Math.min(want, fits));
  const grid = el('grid');
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.width = `min(calc(100vw - 44px), ${cols * TILE}px)`;
}

function render(shuffle = false) {
  const list = shuffle ? shuffled(minted) : minted;
  el('count').textContent = minted.length
    ? `${minted.length} minted of 180`
    : 'Nothing minted yet.';
  layout(list.length);

  // No captions in the block: they would sit between the rows and break it.
  // The number rides on the tile, and clicking gives the full detail.
  el('grid').innerHTML = list.map(({ tokenId, artwork }, i) => {
    const prov = provById.get(artwork);
    return `<figure data-i="${i}" title="#${tokenId}">`
      + renderItem(EDITION[artwork - 1])
      + `<b class="tag${prov ? ' prov' : ''}">#${tokenId}</b></figure>`;
  }).join('');

  for (const fig of el('grid').querySelectorAll('figure')) {
    fig.onclick = () => openDetail(list[Number(fig.dataset.i)]);
  }
}

/// Item detail: traits, owner, and the transaction it came from.
function openDetail({ tokenId, artwork, owner, tx }) {
  const item = EDITION[artwork - 1];
  el('art').innerHTML = renderItem(item);
  el('title').textContent = 'What Do I Get, 1978';

  const rank = rankById.get(artwork);
  const rows = [
    ['Item', `#${tokenId}`],
    ['Rarity rank', `${rank} of 180`],
    ...Object.entries(traitsOf(item)),
  ];
  let html = rows.map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  if (provById.get(artwork)) {
    html += '<div class="row"><dt>Provenance</dt>'
      + '<dd class="prov">Malcolm Garrett 1978</dd></div>';
  }
  html += `<div class="row"><dt>Transaction</dt><dd><a target="_blank" rel="noopener" `
    + `href="${explorer}/tx/${tx}">${tx.slice(0, 10)}…${tx.slice(-6)}</a></dd></div>`;
  html += `<div class="row"><dt>Owner</dt><dd><a target="_blank" rel="noopener" `
    + `href="${explorer}/address/${owner}">${owner.slice(0, 8)}…${owner.slice(-4)}</a></dd></div>`;
  html += `<div class="row"><dt>Token</dt><dd><a target="_blank" rel="noopener" `
    + `href="${explorer}/nft/${CONTRACT}/${tokenId}">Etherscan</a></dd></div>`;
  el('traits').innerHTML = html;
  el('overlay').classList.add('on');
}

const closeDetail = () => el('overlay').classList.remove('on');
el('detail-close').onclick = closeDetail;
el('overlay').addEventListener('click', (e) => {
  if (e.target === el('overlay') || e.target.classList.contains('inner')) closeDetail();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

addEventListener('resize', () => layout(minted.length));
el('shuffle').onclick = () => render(true);
el('reload').onclick = load;
load();
