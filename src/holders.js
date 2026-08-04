// Who holds the edition right now, read from the chain: every ERC-721
// Transfer replayed in order gives each token's current owner; grouping gives
// the holder list. Each holder links to /minted/<address>, their own page.

const CONTRACT = document.body.dataset.contract || '';
const NETWORK = document.body.dataset.network || 'sepolia';
const FROM_BLOCK = document.body.dataset.fromBlock || '0x0';
// The providers measured to serve our getLogs range - see src/minted.js.
const LOG_RPCS = document.body.dataset.rpc ? [document.body.dataset.rpc]
  : NETWORK === 'sepolia'
    ? ['https://sepolia.drpc.org']
    : ['https://rpc.mevblocker.io', 'https://eth.drpc.org'];

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const el = (id) => document.getElementById(id);
const explorer = `https://${NETWORK === 'sepolia' ? 'sepolia.' : ''}etherscan.io`;
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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

async function rpcAny(urls, method, params) {
  let lastErr;
  for (const url of urls) {
    try { return await rpc(url, method, params); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

async function load() {
  if (!CONTRACT) {
    el('list').innerHTML = '<p class="note">Not deployed yet.</p>';
    return;
  }
  el('count').textContent = 'reading the chain…';
  try {
    const logs = await rpcAny(LOG_RPCS, 'eth_getLogs', [{
      address: CONTRACT,
      topics: [TRANSFER_TOPIC],
      fromBlock: FROM_BLOCK,
      toBlock: 'latest',
    }]);

    // Replay in chain order; the last transfer of each token names its owner.
    logs.sort((a, b) => {
      const d = (BigInt(a.blockNumber) - BigInt(b.blockNumber))
        || (BigInt(a.logIndex) - BigInt(b.logIndex));
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    });
    const ownerOf = new Map();
    for (const l of logs) {
      ownerOf.set(Number(BigInt(l.topics[3])), `0x${l.topics[2].slice(26)}`);
    }

    const held = new Map();
    for (const owner of ownerOf.values()) {
      held.set(owner, (held.get(owner) ?? 0) + 1);
    }
    const holders = [...held.entries()].sort((a, b) => b[1] - a[1]);

    el('count').textContent =
      `${holders.length} wallets hold ${ownerOf.size} of 180`;
    el('list').innerHTML = holders.map(([addr, n], i) =>
      `<div class="row"><dt>${i + 1}
        <a href="/minted/${addr}">${short(addr)}</a>
        <a class="ext" target="_blank" rel="noopener" href="${explorer}/address/${addr}">↗</a></dt>
        <dd>${n}</dd></div>`).join('');
  } catch (err) {
    el('count').textContent = '';
    el('list').innerHTML = `<p class="note">Could not read the chain: ${err.message}</p>`;
  }
}

load();
