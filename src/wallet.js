// Wallet discovery and connection, with no dependencies.
//
// EIP-6963 is why Phantom shows up next to MetaMask without being special-cased:
// every modern wallet announces itself over a window event with its own name,
// icon and provider, instead of them all fighting over window.ethereum. We ask
// once, collect whoever answers, and let the user pick.
//
// window.ethereum is still read as a fallback for wallets that never announce.

const CHAIN = {
  sepolia: {
    id: 11155111, hex: '0xaa36a7', name: 'Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
  },
  mainnet: {
    id: 1, hex: '0x1', name: 'Ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
  },
};

const providers = new Map();   // uuid -> { info, provider }
let announced = false;

function collect() {
  if (announced) return;
  announced = true;
  addEventListener('eip6963:announceProvider', (e) => {
    const { info, provider } = e.detail;
    providers.set(info.uuid, { info, provider });
  });
  dispatchEvent(new Event('eip6963:requestProvider'));
}

/// Wallets that have announced themselves, plus an injected fallback.
export function available() {
  collect();
  const list = [...providers.values()];
  if (list.length === 0 && window.ethereum) {
    list.push({
      info: { uuid: 'injected', name: 'Browser wallet', icon: '' },
      provider: window.ethereum,
    });
  }
  return list;
}

export async function connect(provider) {
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) throw new Error('No account returned');
  return accounts[0];
}

export async function chainId(provider) {
  return Number(await provider.request({ method: 'eth_chainId' }));
}

/// Switch to `target`, adding it if the wallet has never seen it.
export async function switchChain(provider, target = 'sepolia') {
  const c = CHAIN[target];
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: c.hex }],
    });
  } catch (err) {
    // 4902: unrecognised chain. Anything else is the user declining, or a wallet
    // that cannot switch - either way, surface it rather than swallowing it.
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: c.hex,
        chainName: c.name,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [c.rpc],
        blockExplorerUrls: [c.explorer],
      }],
    });
  }
}

// --- the small amount of ABI encoding we need -------------------------------

const enc = new TextEncoder();

/// keccak256 is not in the browser, so selectors are precomputed rather than
/// hashed at runtime. Recompute with `cast sig '<signature>'` if the ABI changes.
export const SELECTOR = {
  phase: '0xb1c9fe6e',            // phase()
  price: '0xa035b1fe',            // price()
  totalMinted: '0xa2309ff8',      // totalMinted()
  publicLimit: '0xa4331d2d',      // publicLimit()
  maxSupply: '0x32cb6b0c',        // MAX_SUPPLY()
  allowlistRoot: '0x9c9c6669',    // allowlistRoot()
  mintedAllowlist: '0x0f83fee1',  // mintedAllowlist(address)
  mintedPublic: '0x1f846157',     // mintedPublic(address)
  mintAllowlist: '0x6c96b083',    // mintAllowlist(bytes32[])
  mintPublic: '0xefd0cbf9',       // mintPublic(uint256)
};

const pad = (hex) => hex.replace(/^0x/, '').padStart(64, '0');

export const encodeUint = (n) => pad(BigInt(n).toString(16));
export const encodeAddress = (a) => pad(a.toLowerCase());

/// bytes32[] as a dynamic array: offset, length, then the words.
export function encodeBytes32Array(items) {
  return encodeUint(32) + encodeUint(items.length) + items.map((i) => pad(i)).join('');
}

export async function call(provider, to, data) {
  return provider.request({ method: 'eth_call', params: [{ to, data }, 'latest'] });
}

export async function send(provider, { from, to, data, value }) {
  return provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, data, ...(value ? { value: `0x${BigInt(value).toString(16)}` } : {}) }],
  });
}

export const toEth = (wei) => {
  const s = BigInt(wei).toString().padStart(19, '0');
  const out = `${s.slice(0, -18)}.${s.slice(-18)}`.replace(/0+$/, '').replace(/\.$/, '');
  return out || '0';
};

export const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export { CHAIN };
