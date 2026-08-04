// The real collection, read from the chain, shared by every page that shows it.
//
// The poster pages (app.js) and the minted gallery (minted.js) render the same
// edition against the same on-chain Minted log. Reading that log, and the detail
// panel that opens on a tile - traits, rarity, provenance, and the on-chain
// facts owner/transaction/OpenSea - live here once, so the two never drift.

import { enumerateEdition, renderItem, traitsOf } from './item.js';
import { POSTER_STATES } from './provenance.js';
import { buildEdition } from './rarity.js';

export { renderItem, traitsOf };

// The deterministic edition: EDITION[artwork - 1] is the artwork a token carries.
export const EDITION = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });

const { ranked } = buildEdition();
const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
// provenance is a property of the item, not a rank cutoff: read it from the
// edition rather than assuming the first N ranks carry it.
const provById = new Map(ranked.map((r) => [r.id, r.provenance]));

// keccak256("Minted(address,uint256,uint256)")
const MINTED_TOPIC = '0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff';
const TOTAL_MINTED = '0xa2309ff8'; // totalMinted()

// The page carries the contract, network, and deploy block on <body>. Most free
// endpoints refuse a getLogs range this wide (archive-gated, or capped at 10-50
// blocks) and flashbots answers it with an EMPTY result rather than an error - a
// lie that renders as "nothing minted". So each network names providers measured
// to serve this exact query, tried in order and cross-checked against
// totalMinted(). Override with data-rpc on the body to pin a single endpoint.
export function chainConfig(body = document.body) {
  const contract = body.dataset.contract || '';
  const network = body.dataset.network || 'sepolia';
  const fromBlock = body.dataset.fromBlock || '0x0';
  const sepolia = network === 'sepolia';
  return {
    contract, network, fromBlock, sepolia,
    logRpcs: body.dataset.rpc ? [body.dataset.rpc]
      : sepolia ? ['https://sepolia.drpc.org']
        : ['https://rpc.mevblocker.io', 'https://eth.drpc.org'],
    callRpcs: sepolia
      ? ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.drpc.org']
      : ['https://ethereum-rpc.publicnode.com', 'https://rpc.mevblocker.io', 'https://eth.drpc.org'],
    explorer: `https://${sepolia ? 'sepolia.' : ''}etherscan.io`,
    opensea: (tokenId) => (sepolia
      ? `https://testnets.opensea.io/assets/sepolia/${contract}/${tokenId}`
      : `https://opensea.io/assets/ethereum/${contract}/${tokenId}`),
  };
}

export async function rpc(url, method, params) {
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
export async function rpcAny(urls, method, params) {
  let lastErr;
  for (const url of urls) {
    try { return await rpc(url, method, params); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

/// Read the whole Minted log: one row per token - its artwork, owner, and the
/// transaction it came from - sorted by token id. This is the only place a
/// token's artwork is written on chain, so every page needs it.
export async function loadMinted(cfg) {
  if (!cfg.contract) throw new Error('Not deployed yet.');

  // How many logs there OUGHT to be. Best-effort: if every call provider is
  // down too, 0 accepts the first log answer, which is no worse than before.
  const total = await rpcAny(cfg.callRpcs, 'eth_call', [{ to: cfg.contract, data: TOTAL_MINTED }, 'latest'])
    .then((r) => Number(BigInt(r === '0x' ? '0x0' : r)))
    .catch(() => 0);

  const params = [{
    address: cfg.contract, topics: [MINTED_TOPIC],
    fromBlock: cfg.fromBlock, toBlock: 'latest',
  }];
  let logs = null, lastErr;
  for (const url of cfg.logRpcs) {
    try {
      const got = await rpc(url, 'eth_getLogs', params);
      // Believe a provider only if it accounts for every known mint; otherwise
      // keep the fullest answer seen and try the next.
      if (!logs || got.length > logs.length) logs = got;
      if (logs.length >= total) break;
    } catch (err) { lastErr = err; }
  }
  if (logs === null) throw lastErr ?? new Error('no provider answered');

  return logs.map((l) => ({
    tokenId: Number(BigInt(l.topics[2])),
    artwork: Number(BigInt(l.data)),
    owner: `0x${l.topics[1].slice(26)}`,
    tx: l.transactionHash,
  })).sort((a, b) => a.tokenId - b.tokenId);
}

export const artworkOf = (token) => EDITION[token.artwork - 1];
export const isProvenanced = (token) => provById.get(token.artwork);

/// The detail panel shared by every tile everywhere: traits, rarity rank,
/// provenance, then the on-chain facts - transaction, owner, Etherscan, OpenSea.
export function detailHTML(token, cfg) {
  const { tokenId, artwork, owner, tx } = token;
  const item = artworkOf(token);

  const rows = [
    ['Item', `#${tokenId}`],
    ['Rarity rank', `${rankById.get(artwork)} of 180`],
    ...Object.entries(traitsOf(item)),
  ];
  let html = rows.map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  if (provById.get(artwork)) {
    html += '<div class="row"><dt>Provenance</dt>'
      + '<dd class="prov">Malcolm Garrett 1978</dd></div>';
  }
  html += `<div class="row"><dt>Transaction</dt><dd><a target="_blank" rel="noopener" `
    + `href="${cfg.explorer}/tx/${tx}">${tx.slice(0, 10)}…${tx.slice(-6)}</a></dd></div>`;
  html += `<div class="row"><dt>Owner</dt><dd><a target="_blank" rel="noopener" `
    + `href="${cfg.explorer}/address/${owner}">${owner.slice(0, 8)}…${owner.slice(-4)}</a></dd></div>`;
  html += `<div class="row"><dt>Token</dt><dd><a target="_blank" rel="noopener" `
    + `href="${cfg.explorer}/nft/${cfg.contract}/${tokenId}">Etherscan</a></dd></div>`;
  html += `<div class="row"><dt>Marketplace</dt><dd><a target="_blank" rel="noopener" `
    + `href="${cfg.opensea(tokenId)}">OpenSea</a></dd></div>`;
  return html;
}
