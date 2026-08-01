// ENS resolution with no dependencies: keccak-256, namehash, and two eth_calls
// against the mainnet registry. It exists so the checker can take "name.eth"
// instead of demanding the raw address.
//
// keccak is implemented here because the browser has no native keccak-256
// (SubtleCrypto's SHA-3 is the NIST-padded variant, which Ethereum predates).
// BigInt lanes keep it short; speed is irrelevant at one hash per lookup.

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// rho rotation offsets by lane index x + 5y
const RHO = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const MASK = (1n << 64n) - 1n;
const rot = (v, n) => n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;

function keccakF(A) {
  for (let r = 0; r < 24; r++) {
    const C = [], D = [];
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rot(C[(x + 1) % 5], 1);
    for (let i = 0; i < 25; i++) A[i] ^= D[i % 5];
    const B = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rot(A[x + 5 * y], RHO[x + 5 * y]);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        A[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & MASK) & B[(x + 2) % 5 + 5 * y]);
      }
    }
    A[0] ^= RC[r];
  }
}

/// keccak-256 of bytes, as a 0x hex string.
export function keccak256(bytes) {
  const A = new Array(25).fill(0n);
  const rate = 136;
  // keccak (pre-NIST) pads 0x01 ... 0x80, not SHA-3's 0x06
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF(A);
  }

  let out = '0x';
  for (let i = 0; i < 4; i++) {
    for (let b = 0; b < 8; b++) {
      out += Number((A[i] >> BigInt(8 * b)) & 0xffn).toString(16).padStart(2, '0');
    }
  }
  return out;
}

const enc = new TextEncoder();
const hexToBytes = (hex) => new Uint8Array(
  hex.replace(/^0x/, '').match(/../g).map((b) => parseInt(b, 16)));

/// ENS namehash. Labels are lowercased only - full UTS-46 normalisation is a
/// library in itself; plain ascii names, which is all of them in practice here,
/// are unaffected.
export function namehash(name) {
  let node = new Uint8Array(32);
  const labels = name.trim().toLowerCase().split('.');
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = hexToBytes(keccak256(enc.encode(labels[i])));
    const joined = new Uint8Array(64);
    joined.set(node);
    joined.set(labelHash, 32);
    node = hexToBytes(keccak256(joined));
  }
  return '0x' + [...node].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ENS lives on mainnet regardless of where the mint contract is.
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const RPC = 'https://ethereum-rpc.publicnode.com';
const SEL_RESOLVER = '0x0178b8bf';  // resolver(bytes32)
const SEL_ADDR = '0x3b3b57de';      // addr(bytes32)

async function ethCall(to, data) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

const isZero = (word) => !word || /^0x0*$/.test(word);

/// name.eth -> 0x address, or null if the name has no resolver or no address.
export async function resolveEns(name) {
  const node = namehash(name).slice(2);
  const resolver = await ethCall(ENS_REGISTRY, SEL_RESOLVER + node);
  if (isZero(resolver)) return null;
  const addr = await ethCall('0x' + resolver.slice(-40), SEL_ADDR + node);
  if (isZero(addr)) return null;
  return '0x' + addr.slice(-40);
}

export const looksLikeEns = (s) => /^[^\s.]+(\.[^\s.]+)+$/.test(s.trim()) && !s.trim().startsWith('0x');
