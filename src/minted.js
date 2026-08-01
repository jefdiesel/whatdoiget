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
// Most free endpoints refuse a getLogs range this wide (archive-gated, or
// capped at 10-50 blocks), and flashbots answers it with an EMPTY result
// rather than an error - a lie that would render as "Nothing minted yet".
// So: a list of providers measured to serve this exact query, tried in order,
// each answer cross-checked against totalMinted() before it is believed.
// Override with data-rpc on the body to pin a single endpoint.
const LOG_RPCS = document.body.dataset.rpc ? [document.body.dataset.rpc]
  : NETWORK === 'sepolia'
    ? ['https://sepolia.drpc.org']
    : ['https://rpc.mevblocker.io', 'https://eth.drpc.org'];
// eth_call is served by everyone; this list is for the totalMinted cross-check.
const CALL_RPCS = NETWORK === 'sepolia'
  ? ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org']
  : ['https://ethereum-rpc.publicnode.com', 'https://rpc.mevblocker.io', 'https://eth.drpc.org'];
const TOTAL_MINTED = '0xa2309ff8'; // totalMinted()

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
const opensea = (tokenId) => (NETWORK === 'sepolia'
  ? `https://testnets.opensea.io/assets/sepolia/${CONTRACT}/${tokenId}`
  : `https://opensea.io/assets/ethereum/${CONTRACT}/${tokenId}`);
let minted = [];

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/// The same request against each provider in turn; first answer wins.
async function rpcAny(urls, method, params) {
  let lastErr;
  for (const url of urls) {
    try { return await rpc(url, method, params); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

async function load() {
  if (!CONTRACT) {
    el('grid').innerHTML = '<p class="note">Not deployed yet.</p>';
    return;
  }
  el('count').textContent = 'reading the chain…';
  try {
    // How many logs there OUGHT to be. Best-effort: if every call provider is
    // down too, 0 accepts the first log answer, which is no worse than before.
    const total = await rpcAny(CALL_RPCS, 'eth_call', [{ to: CONTRACT, data: TOTAL_MINTED }, 'latest'])
      .then((r) => Number(BigInt(r === '0x' ? '0x0' : r)))
      .catch(() => 0);

    const params = [{
      address: CONTRACT,
      topics: [MINTED_TOPIC],
      fromBlock: FROM_BLOCK,
      toBlock: 'latest',
    }];
    let logs = null, lastErr;
    for (const url of LOG_RPCS) {
      try {
        const got = await rpc(url, 'eth_getLogs', params);
        // Believe a provider only if it accounts for every known mint;
        // otherwise keep the fullest answer seen and try the next.
        if (!logs || got.length > logs.length) logs = got;
        if (logs.length >= total) break;
      } catch (err) { lastErr = err; }
    }
    if (logs === null) throw lastErr ?? new Error('no provider answered');

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

/// Lay the minted items out as a near-square block that steps toward the
/// poster. Up to 5x5 it grows by square root: 3 across at three, 2x2 at four,
/// 3x3 at nine. Past a filled 5x5 the tiles scale down in three steps - 7 wide
/// through 49, 9 wide through 81 - and the final step goes 12 wide, so the
/// complete edition sits as the 12x15 sheet, the poster reassembled. Columns
/// stay capped by what the viewport fits: phones hold 2-3 across and scroll.
function layout(n) {
  const TILE = 210;                       // a comfortable tile at full size
  // 80px per column is the floor that still lets a 1024 laptop hold the full
  // 12-wide sheet; phones fit 3-4 columns and scroll.
  const fits = Math.max(1, Math.floor((Math.min(innerWidth, 1300) - 44) / 80));
  const want = n <= 3 ? n
    : n <= 25 ? Math.ceil(Math.sqrt(n))
    : n <= 49 ? 7
    : n <= 81 ? 9
    : 12;
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
  html += `<div class="row"><dt>Marketplace</dt><dd><a target="_blank" rel="noopener" `
    + `href="${opensea(tokenId)}">OpenSea</a></dd></div>`;
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
