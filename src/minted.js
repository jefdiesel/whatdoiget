// What has actually been minted, read from the chain.
//
// The whole edition, or one wallet's holdings at /minted/<address or name.eth>.
// The chain read and the item detail panel are shared with the poster pages
// through collection.js; this page adds the near-square layout and the
// per-wallet filter. Wallet connect ("Mine") lives in the shared header (nav.js).

import {
  chainConfig, loadMinted, detailHTML, renderItem, artworkOf, rpcAny,
} from './collection.js';
import { resolveEns, looksLikeEns } from './ens.js';

const cfg = chainConfig();

// keccak256("Transfer(address,address,uint256)") - the ERC-721 standard event
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// /minted shows everyone; /minted/<address or name.eth> shows one minter.
// The slug is resolved once at load - an ENS name becomes an address before
// the log query, and the event's indexed `to` lets the node do the filtering.
const SLUG = decodeURIComponent(location.pathname).match(/^\/minted\/([^/]+)\/?$/)?.[1] ?? null;

const el = (id) => document.getElementById(id);
let minted = [];

/// The slug as an address: passed through if it already is one, resolved on
/// mainnet if it is an ENS name, null when there is no slug.
async function slugAddress() {
  if (!SLUG) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(SLUG)) return SLUG.toLowerCase();
  if (looksLikeEns(SLUG)) {
    const addr = await resolveEns(SLUG);
    if (addr) return addr.toLowerCase();
  }
  throw new Error(`"${SLUG}" is not an address or a name that resolves`);
}

async function load() {
  if (!cfg.contract) {
    el('grid').innerHTML = '<p class="note">Not deployed yet.</p>';
    return;
  }
  try {
    const who = await slugAddress();
    const all = await loadMinted(cfg);
    minted = who ? await heldBy(who, all) : all;
  } catch (err) {
    el('grid').innerHTML = `<p class="note">Could not read the chain: ${err.message}</p>`;
    return;
  }
  render();
}

/// What the wallet holds NOW, not what it minted: ERC-721 Transfer events in
/// and out of the address (both indexed, so the node filters), replayed in
/// order - a token belongs to the wallet iff its latest transfer points there.
/// Mints count too: _mint emits Transfer(0x0 -> minter).
async function heldBy(who, all) {
  const pad = `0x${who.slice(2).padStart(64, '0')}`;
  const range = { address: cfg.contract, fromBlock: cfg.fromBlock, toBlock: 'latest' };
  const [ins, outs] = await Promise.all([
    rpcAny(cfg.logRpcs, 'eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, null, pad] }]),
    rpcAny(cfg.logRpcs, 'eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, pad, null] }]),
  ]);

  // Merge, dedupe (a self-transfer appears in both), replay in chain order.
  const events = [...new Map([...ins, ...outs].map((l) => [`${l.blockNumber}:${l.logIndex}`, l])).values()]
    .sort((a, b) => {
      const d = (BigInt(a.blockNumber) - BigInt(b.blockNumber))
        || (BigInt(a.logIndex) - BigInt(b.logIndex));
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    });

  const last = new Map();   // tokenId -> { to, tx } after the latest event seen
  for (const l of events) {
    last.set(Number(BigInt(l.topics[3])), { to: `0x${l.topics[2].slice(26)}`, tx: l.transactionHash });
  }

  const artworkById = new Map(all.map((m) => [m.tokenId, m.artwork]));
  return [...last.entries()]
    .filter(([, v]) => v.to === who)
    .map(([tokenId, v]) => ({ tokenId, artwork: artworkById.get(tokenId), owner: who, tx: v.tx }))
    .sort((a, b) => a.tokenId - b.tokenId);
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
  // The collective view lets 2-3 items sit in one row; a wallet's own page
  // squares up immediately - 3 held reads as a 2x2 with a gap, not a strip.
  const want = (n <= 3 && !SLUG) ? n
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
  if (!list.length) {
    el('grid').innerHTML = `<p class="note">${SLUG ? 'Nothing held by this address.' : 'Nothing minted yet.'}</p>`;
    el('grid').style.width = '';
    return;
  }
  layout(list.length);

  // Just the blocks: no captions, no tags. Clicking a tile gives the full
  // detail - traits, rarity, owner, and the transaction it came from.
  el('grid').innerHTML = list.map((token, i) =>
    `<figure data-i="${i}" title="#${token.tokenId}">${renderItem(artworkOf(token))}</figure>`
  ).join('');

  for (const fig of el('grid').querySelectorAll('figure')) {
    fig.onclick = () => openDetail(list[Number(fig.dataset.i)]);
  }
}

/// Item detail: traits, rarity, owner, and the transaction it came from - the
/// same panel the poster pages open, from collection.js.
function openDetail(token) {
  el('art').innerHTML = renderItem(artworkOf(token));
  el('title').textContent = 'What Do I Get, 1978';
  el('traits').innerHTML = detailHTML(token, cfg);
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
el('redistribute').onclick = () => render(true);
load();
