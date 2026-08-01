// The allowlist checker. Connect a wallet or paste an address, and the page
// says whether that address gets the free allowlist mint.
//
// The list is re-fetched on every check with cache: 'no-store', because the
// allowlist keeps growing right up to the drop: a wallet added five minutes ago
// must show up without anyone hard-refreshing.

import { available, connect, short } from './wallet.js';
import { INK, PAPER, SPOT, CUT_TOP, CUT_BOTTOM } from './master.js';

const el = (id) => document.getElementById(id);
let account = null;

const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);

// Always fetched fresh - see the header comment.
async function loadAllowlist() {
  const res = await fetch('./allowlist.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the allowlist. Try again in a moment.');
  return res.json();
}

function renderWallets() {
  const list = available();
  const box = el('wallets');
  if (!list.length) {
    box.innerHTML = '<p class="note">No browser wallet found — paste your address below instead.</p>';
    return;
  }
  box.innerHTML = '';
  for (const { info, provider } of list) {
    const b = document.createElement('button');
    b.className = 'wallet';
    b.innerHTML = (info.icon ? `<img src="${info.icon}" alt="" width="22" height="22">` : '')
      + `<span>${info.name}</span>`;
    b.onclick = async () => {
      try {
        account = await connect(provider);
        el('address').value = account;
        el('connected').textContent = `Connected — ${short(account)}`;
        provider.on?.('accountsChanged', (a) => {
          account = a[0] ?? null;
          el('address').value = account ?? '';
          el('connected').textContent = account ? `Connected — ${short(account)}` : '';
          el('result').innerHTML = '';
        });
        await check();
      } catch (err) { showError(err); }
    };
    box.append(b);
  }
}

function showError(err) {
  // 4001 is the user closing the wallet prompt - not worth alarming anyone.
  el('result').innerHTML = '';
  el('error').textContent = err?.code === 4001 ? 'Cancelled in wallet.'
    : (err?.message || String(err));
}

// The verdict as a square in the edition's own language: the master cut with
// ink to the left, the word reversed out of the ink the way the inverted plate
// does it, skewed like every piece of display type on the site. ON! prints on
// the edition's navy plate, OFF on the red one - both colours come from
// master.js, not from here.
function verdictArt(on) {
  const S = 480;
  const word = on ? 'ON!' : 'OFF';
  const ink = on ? INK : SPOT;
  const cut = `0,0 ${CUT_TOP * S},0 ${CUT_BOTTOM * S},${S} 0,${S}`;
  return `<svg class="verdict-art" viewBox="0 0 ${S} ${S}" role="img"
    aria-label="${on ? 'On the list' : 'Not on the list'}">
    <rect width="${S}" height="${S}" fill="${PAPER}"/>
    <polygon points="${cut}" fill="${ink}"/>
    <text x="26" y="200" fill="${PAPER}" transform="skewX(-9)" transform-origin="26 200"
      font-family="Haettenschweiler, 'Arial Narrow', Impact, sans-serif"
      font-size="170" font-weight="700">${word}</text>
  </svg>`;
}

async function check() {
  el('error').textContent = '';
  const addr = el('address').value.trim();
  if (!addr) return showError(new Error('Connect a wallet or paste an address first.'));
  if (!isAddress(addr)) return showError(new Error('That is not an Ethereum address — expected 0x followed by 40 hex characters.'));

  const box = el('result');
  box.innerHTML = '<p class="note">Checking…</p>';
  try {
    const list = await loadAllowlist();
    const onList = Boolean(list?.proofs?.[addr.toLowerCase()]);
    box.innerHTML = verdictArt(onList) + (onList
      ? `<p class="note">${short(addr)} can mint <b>1 free</b> when the allowlist phase opens.</p>`
      : `<p class="note">${short(addr)} has no free mint. The list is still being added to
         before the drop — check again later, or come back for the public mint.</p>`);
  } catch (err) {
    box.innerHTML = '';
    showError(err);
  }
}

el('check').onclick = check;
el('address').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
el('address').addEventListener('input', () => { el('result').innerHTML = ''; el('error').textContent = ''; });
renderWallets();
