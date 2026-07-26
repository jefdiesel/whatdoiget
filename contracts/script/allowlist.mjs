// Build the allowlist merkle tree and the per-address proofs the mint page serves.
//
//   node script/allowlist.mjs data/allowlist.txt
//
// Input: one address per line (blank lines and # comments ignored).
// Output: contracts/data/allowlist.json  -> { root, proofs: { address: [...] } }
//         ../public-allowlist.json       -> the same, copied where the site reads it
//
// Leaves are keccak256(keccak256(abi.encode(address))) - the double hash is what
// OpenZeppelin's StandardMerkleTree uses and what the contract verifies, so an
// allowlist built any other way will produce proofs that always revert.

import { readFile, writeFile } from 'node:fs/promises';
import { keccak256, encodeAbiParameters, isAddress, getAddress } from 'viem';

const input = process.argv[2] ?? 'data/allowlist.txt';

const raw = await readFile(new URL(`../${input}`, import.meta.url), 'utf8');
const addresses = [...new Set(
  raw.split('\n')
    .map((l) => l.split('#')[0].trim())
    .filter(Boolean)
    .map((a) => {
      if (!isAddress(a)) throw new Error(`not an address: ${a}`);
      return getAddress(a);   // checksum, so duplicates in different cases collapse
    })
)];

if (addresses.length === 0) throw new Error('allowlist is empty');

const leafOf = (addr) =>
  keccak256(keccak256(encodeAbiParameters([{ type: 'address' }], [addr])));

// Sorted-pair tree: hash(min, max) at every node, which is what MerkleProof
// verifies without needing position bits.
const hashPair = (a, b) =>
  keccak256(`0x${(a < b ? a + b.slice(2) : b + a.slice(2)).slice(2)}`);

const leaves = addresses.map(leafOf);

function build(level) {
  const layers = [level];
  while (layers.at(-1).length > 1) {
    const prev = layers.at(-1);
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    }
    layers.push(next);
  }
  return layers;
}

const layers = build(leaves);
const root = layers.at(-1)[0];

function proofFor(index) {
  const proof = [];
  let idx = index;
  for (let l = 0; l < layers.length - 1; l++) {
    const layer = layers[l];
    const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sibling < layer.length) proof.push(layer[sibling]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

const proofs = {};
addresses.forEach((addr, i) => { proofs[addr.toLowerCase()] = proofFor(i); });

// Self-check: every proof must verify against the root before we ship it.
function verify(leaf, proof) {
  let computed = leaf;
  for (const p of proof) computed = hashPair(computed, p);
  return computed === root;
}
for (const [addr, proof] of Object.entries(proofs)) {
  if (!verify(leafOf(getAddress(addr)), proof)) {
    throw new Error(`proof failed to verify for ${addr}`);
  }
}

const out = { root, count: addresses.length, proofs };

// A flat fixture so the Solidity test can cross-check these proofs against the
// contract's own verifier. If the JS tree and MerkleProof disagree, every
// allowlist mint reverts - better to find that here than on mainnet.
await writeFile(new URL('../data/allowlist-fixture.json', import.meta.url), JSON.stringify({
  root,
  addresses,
  proofs: addresses.map((a) => proofs[a.toLowerCase()]),
}, null, 2));
await writeFile(new URL('../data/allowlist.json', import.meta.url), JSON.stringify(out, null, 2));
await writeFile(new URL('../../allowlist.json', import.meta.url), JSON.stringify(out));

console.log(`addresses  ${addresses.length}`);
console.log(`root       ${root}`);
console.log(`verified   all ${addresses.length} proofs check out against the root`);
console.log(`wrote      contracts/data/allowlist.json and allowlist.json (site)`);
console.log(`\nnext: setAllowlistRoot(${root})`);
