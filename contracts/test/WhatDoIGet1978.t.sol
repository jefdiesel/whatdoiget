// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WhatDoIGet1978} from "../src/WhatDoIGet1978.sol";
import {Glyphs} from "../src/Glyphs.sol";

contract WhatDoIGet1978Test is Test {
    WhatDoIGet1978 nft;
    Glyphs glyphs;

    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address carol = address(0xCA401);

    // A two-leaf allowlist over {alice, bob}. Leaves are double-hashed, which is
    // what OpenZeppelin's JS tree does and what the contract verifies against.
    bytes32 leafAlice;
    bytes32 leafBob;
    bytes32 root;

    function setUp() public {
        glyphs = new Glyphs();
        nft = new WhatDoIGet1978(address(glyphs), owner);

        leafAlice = keccak256(bytes.concat(keccak256(abi.encode(alice))));
        leafBob = keccak256(bytes.concat(keccak256(abi.encode(bob))));
        root = leafAlice < leafBob
            ? keccak256(abi.encodePacked(leafAlice, leafBob))
            : keccak256(abi.encodePacked(leafBob, leafAlice));

        vm.prank(owner);
        nft.setAllowlistRoot(root);
    }

    function _proofFor(bytes32 sibling) internal pure returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = sibling;
    }

    // --- the one that matters ------------------------------------------------

    /// @notice Every one of the 180 on-chain SVGs must equal the JS renderer's
    ///         output byte for byte. Not a hash of a sample - all 180, in full.
    function test_RenderMatchesJavaScriptForAll180() public {
        string memory path = "data/expected.txt";
        for (uint256 id = 1; id <= 180; ++id) {
            string memory expected = vm.readLine(path);
            string memory actual = nft.renderArtwork(id);
            if (keccak256(bytes(expected)) != keccak256(bytes(actual))) {
                emit log_named_uint("token", id);
                emit log_named_string("expected", expected);
                emit log_named_string("actual  ", actual);
                fail();
            }
        }
    }

    function test_RenderArtworkRevertsOutOfRange() public {
        vm.expectRevert(bytes("bad id"));
        nft.renderArtwork(0);
        vm.expectRevert(bytes("bad id"));
        nft.renderArtwork(181);
    }

    // --- phases --------------------------------------------------------------

    function test_MintClosedByDefault() public {
        vm.prank(alice);
        vm.expectRevert(WhatDoIGet1978.WrongPhase.selector);
        nft.mintAllowlist(_proofFor(leafBob));

        uint256 p = nft.price();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(WhatDoIGet1978.WrongPhase.selector);
        nft.mintPublic{value: p}(1);
    }

    function test_AllowlistMintIsFreeAndOncePerWallet() public {
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Allowlist);

        vm.prank(alice);
        nft.mintAllowlist(_proofFor(leafBob));
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.totalMinted(), 1);

        // a second attempt from the same wallet
        vm.prank(alice);
        vm.expectRevert(WhatDoIGet1978.AlreadyClaimed.selector);
        nft.mintAllowlist(_proofFor(leafBob));
    }

    function test_AllowlistRejectsBadProof() public {
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Allowlist);

        vm.prank(carol); // not in the tree
        vm.expectRevert(WhatDoIGet1978.BadProof.selector);
        nft.mintAllowlist(_proofFor(leafBob));
    }

    function test_PublicMintChargesAndCapsAtThree() public {
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        uint256 p = nft.price();
        assertEq(nft.publicLimit(), 3, "paid limit should be 3 per wallet");
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(WhatDoIGet1978.WrongPayment.selector);
        nft.mintPublic{value: 0}(1);

        // three is fine, in any combination
        vm.prank(alice);
        nft.mintPublic{value: p * 2}(2);
        vm.prank(alice);
        nft.mintPublic{value: p}(1);
        assertEq(nft.balanceOf(alice), 3);

        // the fourth is not
        vm.prank(alice);
        vm.expectRevert(WhatDoIGet1978.LimitReached.selector);
        nft.mintPublic{value: p}(1);
    }

    function test_RoyaltyIsExactly1point978Percent() public {
        (address receiver, uint256 amount) = nft.royaltyInfo(1, 1 ether);
        assertEq(receiver, owner);
        // exact, not rounded: 1.978% of 1 ETH
        assertEq(amount, 0.01978 ether);

        (, uint256 onTen) = nft.royaltyInfo(1, 10 ether);
        assertEq(onTen, 0.1978 ether);
    }

    function test_PublicLimitIsSettable() public {
        vm.startPrank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        nft.setPublicLimit(5);
        vm.stopPrank();

        uint256 p = nft.price();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        nft.mintPublic{value: p * 5}(5);
        assertEq(nft.balanceOf(bob), 5);
    }

    function test_AllowlistAndPublicAreSeparateAllowances() public {
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Allowlist);
        vm.prank(alice);
        nft.mintAllowlist(_proofFor(leafBob));

        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        uint256 p = nft.price();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.mintPublic{value: p}(1);

        assertEq(nft.balanceOf(alice), 2);
    }

    function test_SupplyIsCapped() public {
        vm.startPrank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        nft.setPublicLimit(200);
        nft.setPrice(0);
        vm.stopPrank();

        vm.prank(alice);
        nft.mintPublic(180);
        assertEq(nft.totalMinted(), 180);

        vm.prank(bob);
        vm.expectRevert(WhatDoIGet1978.SoldOut.selector);
        nft.mintPublic(1);
    }

    // --- metadata ------------------------------------------------------------

    function test_TokenURIIsSelfContained() public {
        vm.startPrank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        nft.setPrice(0);
        vm.stopPrank();
        vm.prank(alice);
        nft.mintPublic(1);

        string memory uri = nft.tokenURI(1);
        assertTrue(_startsWith(uri, "data:application/json;base64,"), "not a data URI");
        // nothing to resolve: no ipfs://, no http
        assertEq(_indexOf(uri, "ipfs"), type(uint256).max, "contains an ipfs reference");
    }

    function test_TokenURIRevertsForUnminted() public {
        vm.expectRevert();
        nft.tokenURI(1);
    }

    // --- owner ---------------------------------------------------------------

    function test_OnlyOwnerControlsPhase() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.setPhase(WhatDoIGet1978.Phase.Public);
    }

    function test_Withdraw() public {
        vm.prank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        uint256 p = nft.price();
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.mintPublic{value: p}(1);

        uint256 before = owner.balance;
        vm.prank(owner);
        nft.withdraw(payable(owner));
        assertEq(owner.balance - before, p);
    }

    // --- blind mint ----------------------------------------------------------

    function _mintAll() internal {
        vm.startPrank(owner);
        nft.setPhase(WhatDoIGet1978.Phase.Public);
        nft.setPublicLimit(200);
        nft.setPrice(0);
        vm.stopPrank();
        vm.prank(alice);
        nft.mintPublic(180);
    }

    function test_ArtworkIsUnknownBeforeMint() public {
        // nothing is assigned until it is minted, so there is nothing to snipe
        for (uint256 id = 1; id <= 180; ++id) {
            assertEq(nft.artworkOf(id), 0);
        }
        assertEq(nft.remaining(), 180);
    }

    /// @notice The draw must be a real permutation: all 180 artworks handed out,
    ///         none twice. A shuffle that loses or repeats one is worse than none.
    function test_EveryArtworkIsDealtExactlyOnce() public {
        _mintAll();
        assertEq(nft.remaining(), 0);

        bool[181] memory seen;
        for (uint256 id = 1; id <= 180; ++id) {
            uint256 art = nft.artworkOf(id);
            assertTrue(art >= 1 && art <= 180, "artwork out of range");
            assertFalse(seen[art], "artwork dealt twice");
            seen[art] = true;
        }
    }

    /// @notice And it must not be the identity - otherwise it is not shuffled.
    function test_DrawIsNotSequential() public {
        _mintAll();
        uint256 sameAsId;
        for (uint256 id = 1; id <= 180; ++id) {
            if (nft.artworkOf(id) == id) ++sameAsId;
        }
        assertLt(sameAsId, 20, "assignment looks sequential, not shuffled");
    }

    /// @notice A different chain state deals a different hand.
    function test_DifferentRandomnessDealsDifferently() public {
        vm.prevrandao(bytes32(uint256(1)));
        _mintAll();
        uint256 firstA = nft.artworkOf(1);

        WhatDoIGet1978 other = new WhatDoIGet1978(address(glyphs), owner);
        vm.startPrank(owner);
        other.setPhase(WhatDoIGet1978.Phase.Public);
        other.setPublicLimit(200);
        other.setPrice(0);
        vm.stopPrank();
        vm.prevrandao(bytes32(uint256(999)));
        vm.prank(bob);
        other.mintPublic(180);

        assertTrue(firstA != other.artworkOf(1), "same hand from different randomness");
    }

    function test_RenderRevertsForUnmintedToken() public {
        vm.expectRevert(WhatDoIGet1978.NonexistentToken.selector);
        nft.renderSVG(1);
    }

    // --- helpers -------------------------------------------------------------

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory b = bytes(s);
        bytes memory p = bytes(prefix);
        if (b.length < p.length) return false;
        for (uint256 i; i < p.length; ++i) {
            if (b[i] != p[i]) return false;
        }
        return true;
    }

    function _indexOf(string memory hay, string memory needle) internal pure returns (uint256) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return type(uint256).max;
        for (uint256 i; i <= h.length - n.length; ++i) {
            bool hit = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    hit = false;
                    break;
                }
            }
            if (hit) return i;
        }
        return type(uint256).max;
    }
}
