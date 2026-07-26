// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WhatDoIGet1978} from "../src/WhatDoIGet1978.sol";
import {Glyphs} from "../src/Glyphs.sol";

/// @notice The allowlist is built in JavaScript and verified in Solidity. If the
///         two disagree on leaf encoding or pair ordering, every allowlist mint
///         reverts. This asserts they agree, using the real generated tree.
contract AllowlistTest is Test {
    WhatDoIGet1978 nft;
    address owner = address(0xA11CE);

    function setUp() public {
        nft = new WhatDoIGet1978(address(new Glyphs()), owner);
    }

    function test_JsProofsVerifyOnChain() public {
        string memory json = vm.readFile("data/allowlist-fixture.json");
        bytes32 root = vm.parseJsonBytes32(json, ".root");
        address[] memory addrs = vm.parseJsonAddressArray(json, ".addresses");

        vm.prank(owner);
        nft.setAllowlistRoot(root);
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Allowlist);

        for (uint256 i; i < addrs.length; ++i) {
            bytes32[] memory proof =
                vm.parseJsonBytes32Array(json, string.concat(".proofs[", vm.toString(i), "]"));

            assertTrue(nft.isAllowlisted(addrs[i], proof), "js proof rejected by the contract");

            vm.prank(addrs[i]);
            nft.mintAllowlist(proof);
            assertEq(nft.ownerOf(i + 1), addrs[i]);
        }
        assertEq(nft.totalMinted(), addrs.length);
    }

    function test_AddressNotInTreeIsRejected() public {
        string memory json = vm.readFile("data/allowlist-fixture.json");
        bytes32 root = vm.parseJsonBytes32(json, ".root");
        bytes32[] memory proof = vm.parseJsonBytes32Array(json, ".proofs[0]");

        vm.prank(owner);
        nft.setAllowlistRoot(root);
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Allowlist);

        vm.prank(address(0xBEEF));
        vm.expectRevert(WhatDoIGet1978.BadProof.selector);
        nft.mintAllowlist(proof);
    }
}
