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

function render(shuffle = false) {
  const list = shuffle ? shuffled(minted) : minted;
  el('count').textContent = minted.length
    ? `${minted.length} minted of 180`
    : 'Nothing minted yet.';

  el('grid').innerHTML = list.map(({ tokenId, artwork, owner, tx }) => {
    const item = EDITION[artwork - 1];
    const t = traitsOf(item);
    const prov = rankById.get(artwork) <= 36;
    return `<figure>${renderItem(item)}<figcaption>`
      + `<b>#${tokenId}</b>`
      + `<span>${t.Word}</span>`
      + (prov ? '<i class="prov">1978</i>' : '')
      + `</figcaption>`
      + `<div class="links">`
      + `<a target="_blank" rel="noopener" href="${explorer}/nft/${CONTRACT}/${tokenId}">token</a>`
      + `<a target="_blank" rel="noopener" href="${explorer}/tx/${tx}">tx</a>`
      + `<a target="_blank" rel="noopener" href="${explorer}/address/${owner}">${owner.slice(0, 6)}…</a>`
      + `</div></figure>`;
  }).join('');
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

el('shuffle').onclick = () => render(true);
el('reload').onclick = load;
load();
