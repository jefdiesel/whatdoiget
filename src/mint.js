// The mint page. Reads phase and counts straight from the contract, so the UI
// can never claim a phase the chain disagrees with.
//
// No preview: the artwork is drawn at random when the token is minted, so
// showing sample items next to the mint button would only imply a choice that
// does not exist.

import {
  available, connect, chainId, switchChain, call, send, SELECTOR,
  encodeUint, encodeAddress, encodeBytes32Array, toEth, short, CHAIN,
} from './wallet.js';
import { enumerateEdition, renderItem, traitsOf } from './item.js';
import { POSTER_STATES } from './provenance.js';

// Indexed by artwork number: artwork N is items[N - 1]. Used only AFTER a mint,
// to show what was actually drawn - never before, which would undo the blind.
const EDITION = enumerateEdition('UP36348', { posterFirst: POSTER_STATES });

// keccak256("Minted(address,uint256,uint256)") - via cast sig-event
const MINTED_TOPIC = '0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff';
const explorer = () => `https://${NETWORK === 'sepolia' ? 'sepolia.' : ''}etherscan.io`;

const CONTRACT = document.body.dataset.contract || '';
const NETWORK = document.body.dataset.network || 'sepolia';

const PHASE = ['Closed', 'Allowlist', 'Public'];

const el = (id) => document.getElementById(id);
const state = { provider: null, account: null, chain: null, allowlist: null, chainState: null };

// --- reading the contract ---------------------------------------------------

const asUint = (hex) => BigInt(hex === '0x' ? '0x0' : hex);

async function readChain() {
  if (!CONTRACT) return null;
  const p = state.provider;
  const [phase, price, minted, max, limit] = await Promise.all([
    call(p, CONTRACT, SELECTOR.phase),
    call(p, CONTRACT, SELECTOR.price),
    call(p, CONTRACT, SELECTOR.totalMinted),
    call(p, CONTRACT, SELECTOR.maxSupply),
    call(p, CONTRACT, SELECTOR.publicLimit),
  ]);
  const s = {
    phase: Number(asUint(phase)),
    price: asUint(price),
    minted: Number(asUint(minted)),
    max: Number(asUint(max)),
    limit: Number(asUint(limit)),
    claimedAllowlist: false,
    mintedPublic: 0,
  };
  if (state.account) {
    const [ca, mp] = await Promise.all([
      call(p, CONTRACT, SELECTOR.mintedAllowlist + encodeAddress(state.account)),
      call(p, CONTRACT, SELECTOR.mintedPublic + encodeAddress(state.account)),
    ]);
    s.claimedAllowlist = asUint(ca) === 1n;
    s.mintedPublic = Number(asUint(mp));
  }
  return s;
}

async function loadAllowlist() {
  try {
    const res = await fetch('./allowlist.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// --- rendering --------------------------------------------------------------

function renderWallets() {
  const list = available();
  const box = el('wallets');
  if (!list.length) {
    box.innerHTML = '<p class="note">No wallet found. Install MetaMask, Phantom, '
      + 'Rainbow or another browser wallet and reload.</p>';
    return;
  }
  box.innerHTML = '';
  for (const { info, provider } of list) {
    const b = document.createElement('button');
    b.className = 'wallet';
    b.innerHTML = (info.icon ? `<img src="${info.icon}" alt="" width="22" height="22">` : '')
      + `<span>${info.name}</span>`;
    b.onclick = () => onConnect(provider);
    box.append(b);
  }
}

function renderStatus() {
  const s = state.chainState;
  const box = el('status');

  if (!CONTRACT) {
    box.innerHTML = '<p class="note">Not deployed yet. The contract address goes in '
      + '<code>data-contract</code> on <code>mint.html</code>.</p>';
    return;
  }
  if (!s) { box.innerHTML = '<p class="note">Connect a wallet to read the contract.</p>'; return; }

  const wrongChain = state.chain !== CHAIN[NETWORK].id;
  const rows = [
    ['Phase', PHASE[s.phase] ?? 'Unknown'],
    ['Minted', `${s.minted} of ${s.max}`],
    ['Price', s.phase === 1 ? 'Free' : `${toEth(s.price)} ETH`],
    ['Your wallet', state.account ? short(state.account) : '—'],
    ['Network', wrongChain ? `Wrong network — switch to ${CHAIN[NETWORK].name}` : CHAIN[NETWORK].name],
  ];
  box.innerHTML = '<dl>' + rows.map(([k, v]) =>
    `<div class="row"><dt>${k}</dt><dd${/Wrong/.test(v) ? ' class="warn"' : ''}>${v}</dd></div>`
  ).join('') + '</dl>';
}

function renderAction() {
  const s = state.chainState;
  const box = el('action');
  box.innerHTML = '';
  if (!s || !state.account) return;

  if (state.chain !== CHAIN[NETWORK].id) {
    return button(box, `Switch to ${CHAIN[NETWORK].name}`, async () => {
      await switchChain(state.provider, NETWORK);
      await refresh();
    });
  }
  if (s.minted >= s.max) return note(box, 'Sold out.');

  if (s.phase === 0) return note(box, 'Minting is closed. The allowlist opens first.');

  if (s.phase === 1) {
    const proof = state.allowlist?.proofs?.[state.account.toLowerCase()];
    if (!proof) return note(box, 'This wallet is not on the allowlist. Come back for the public mint.');
    if (s.claimedAllowlist) return note(box, 'Already claimed — one per wallet on the allowlist.');
    return button(box, 'Mint — free', () => doMint(
      SELECTOR.mintAllowlist + encodeBytes32Array(proof), 0n));
  }

  const left = s.limit - s.mintedPublic;
  if (left <= 0) return note(box, `You have minted your ${s.limit}. That is the per-wallet limit.`);

  const qty = document.createElement('select');
  qty.id = 'qty';
  for (let i = 1; i <= Math.min(left, s.max - s.minted); i++) {
    qty.append(new Option(`${i}`, `${i}`));
  }
  box.append(qty);
  button(box, `Mint — ${toEth(s.price)} ETH each`, () => {
    const n = BigInt(el('qty').value);
    return doMint(SELECTOR.mintPublic + encodeUint(n), s.price * n);
  });
  note(box, `${left} of ${s.limit} left for this wallet.`);
}

function button(box, label, onClick) {
  const b = document.createElement('button');
  b.className = 'primary';
  b.textContent = label;
  b.onclick = async () => {
    b.disabled = true;
    try { await onClick(); } catch (err) { showError(err); } finally { b.disabled = false; }
  };
  box.append(b);
}

function note(box, text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  box.append(p);
}

function showError(err) {
  // 4001 is the user rejecting in the wallet - not an error worth shouting about
  const msg = err?.code === 4001 ? 'Cancelled in wallet.'
    : (err?.data?.message || err?.message || String(err));
  el('error').textContent = msg;
}

async function doMint(data, value) {
  el('error').textContent = '';
  const hash = await send(state.provider, {
    from: state.account, to: CONTRACT, data, value: value || undefined,
  });

  el('error').innerHTML = `Sent — <a target="_blank" rel="noopener" `
    + `href="${explorer()}/tx/${hash}">${short(hash)}</a> · waiting for confirmation…`;

  const receipt = await waitForReceipt(hash);
  if (!receipt) {
    el('error').innerHTML = `Sent — <a target="_blank" rel="noopener" `
      + `href="${explorer()}/tx/${hash}">${short(hash)}</a>. Taking a while; `
      + `check the explorer.`;
    return;
  }
  if (BigInt(receipt.status) === 0n) {
    el('error').innerHTML = `Reverted — <a target="_blank" rel="noopener" `
      + `href="${explorer()}/tx/${hash}">${short(hash)}</a>`;
    return;
  }

  el('error').textContent = '';
  showMinted(readMintedLogs(receipt), hash);
  await refresh();
}

async function waitForReceipt(hash, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const r = await state.provider.request({
      method: 'eth_getTransactionReceipt', params: [hash],
    });
    if (r) return r;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return null;
}

/// Minted(address indexed to, uint256 indexed tokenId, uint256 artwork)
/// -> tokenId is topic 2; artwork is the only unindexed field, so it is the data.
function readMintedLogs(receipt) {
  return (receipt.logs || [])
    .filter((l) => l.address.toLowerCase() === CONTRACT.toLowerCase()
      && l.topics[0].toLowerCase() === MINTED_TOPIC)
    .map((l) => ({
      tokenId: Number(BigInt(l.topics[2])),
      artwork: Number(BigInt(l.data)),
    }));
}

/// What you actually drew.
function showMinted(minted, hash) {
  const box = el('minted');
  if (!minted.length) { box.hidden = true; return; }
  box.hidden = false;

  box.innerHTML = `<h3>${minted.length === 1 ? 'You minted' : `You minted ${minted.length}`}</h3>`
    + `<div class="got">` + minted.map(({ tokenId, artwork }) => {
      const item = EDITION[artwork - 1];
      const t = traitsOf(item);
      return `<figure>${renderItem(item)}<figcaption>`
        + `<b>#${tokenId}</b> <span>${t.Word} · ${t.Plate}</span>`
        + `</figcaption></figure>`;
    }).join('') + `</div>`
    + `<p class="note"><a target="_blank" rel="noopener" href="${explorer()}/tx/${hash}">`
    + `Transaction ${short(hash)}</a> · `
    + minted.map(({ tokenId }) =>
        `<a target="_blank" rel="noopener" href="${explorer()}/nft/${CONTRACT}/${tokenId}">#${tokenId}</a>`
      ).join(' · ')
    + `</p>`;
}

// --- wiring -----------------------------------------------------------------

async function onConnect(provider) {
  try {
    state.provider = provider;
    state.account = await connect(provider);
    state.chain = await chainId(provider);
    provider.on?.('accountsChanged', (a) => { state.account = a[0] ?? null; refresh(); });
    provider.on?.('chainChanged', () => location.reload());
    el('wallets').hidden = true;
    await refresh();
  } catch (err) { showError(err); }
}

async function refresh() {
  try {
    state.chain = await chainId(state.provider);
    state.chainState = await readChain();
  } catch (err) {
    showError(err);
  }
  renderStatus();
  renderAction();
}

state.allowlist = await loadAllowlist();
renderWallets();
renderStatus();
