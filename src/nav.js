// The header's wallet connect, shared by every page. "Connect Wallet" connects a
// browser wallet and lands on that address's minted page - its own holdings -
// then remembers it, so the button reads "Disconnect" on every page until it is
// clicked again. One announced wallet connects straight away; more than one
// drops a chooser under the button. The header is identical on every page, so
// this wiring lives once.

import { available, connect } from './wallet.js';

const mine = document.getElementById('mine');
const box = document.getElementById('wallets');
const KEY = 'wdig:wallet';

// EIP-6963 wallets announce themselves asynchronously after being asked, so warm
// discovery up on load rather than at the click - otherwise the first click can
// race ahead of the announcements and find nothing.
available();

const link = document.getElementById('mine-link');

function setConnected(on) {
  if (mine) {
    const span = mine.querySelector('span');
    if (span) span.textContent = on ? 'Disconnect' : 'Connect Wallet';
    mine.dataset.connected = on ? '1' : '';
  }
  // The "Mine" link is a way back to your own holdings once you have clicked off
  // that page; it only exists while connected.
  if (link) {
    const addr = localStorage.getItem(KEY);
    if (on && addr) { link.href = `/minted/${addr}`; link.hidden = false; }
    else link.hidden = true;
  }
}

// Reflect the remembered connection on load: a stored address reads as connected.
setConnected(!!localStorage.getItem(KEY));

async function goMine(provider) {
  try {
    const account = await connect(provider);
    localStorage.setItem(KEY, account.toLowerCase());
    location.href = `/minted/${account.toLowerCase()}`;
  } catch (err) {
    // 4001 is the user dismissing the wallet prompt - not an error worth showing.
    if (err?.code !== 4001 && box) {
      box.innerHTML = `<p class="note">${err?.message || String(err)}</p>`;
      box.classList.add('on');
    }
  }
}

// A wallet cannot be force-disconnected over EIP-1193; forgetting the address
// locally is what "Disconnect" means here.
function disconnect() {
  localStorage.removeItem(KEY);
  if (box) box.classList.remove('on');
  setConnected(false);
}

if (mine && box) {
  mine.onclick = () => {
    if (mine.dataset.connected) return disconnect();
    const list = available();
    if (!list.length) {
      box.innerHTML = '<p class="note">No browser wallet found — open /minted/your-address instead.</p>';
      box.classList.add('on');
      return;
    }
    if (list.length === 1) return goMine(list[0].provider);
    box.innerHTML = '';
    box.classList.add('on');
    for (const { info, provider } of list) {
      const b = document.createElement('button');
      b.className = 'wallet';
      b.innerHTML = (info.icon ? `<img src="${info.icon}" alt="" width="20" height="20">` : '')
        + `<span>${info.name}</span>`;
      b.onclick = () => goMine(provider);
      box.append(b);
    }
  };

  // A click outside the button and the chooser dismisses it. Test against the
  // button's whole subtree - the click target is the inner <span>, so a plain
  // `!== mine` would match the opening click and close it on the same tick.
  addEventListener('click', (e) => {
    if (box.classList.contains('on') && !mine.contains(e.target) && !box.contains(e.target)) {
      box.classList.remove('on');
    }
  });
}
