// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {RenderData} from "./RenderData.sol";
import {Glyphs} from "./Glyphs.sol";

/// @title What Do I Get, 1978
/// @notice 180 items, each one square of the Buzzcocks promo poster for
///         "What Do I Get?" (United Artists UP 36348, 1978), designed by
///         Malcolm Garrett. The artwork is rendered entirely on chain: there is
///         no IPFS pointer, no host, and nothing to resolve.
///
///         Token id determines artwork. The 180 tuples are a fixed enumeration
///         baked in at deploy, so minting assigns the next id and nothing else -
///         no randomness, no reveal, no metadata that can drift.
contract WhatDoIGet1978 is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    enum Phase {
        Closed,
        Allowlist,
        Public
    }

    uint256 public constant MAX_SUPPLY = 180;

    Glyphs public immutable glyphs;

    Phase public phase;
    bytes32 public allowlistRoot;
    uint256 public price = 0.001978 ether;
    /// @notice Paid mints per wallet. The allowlist is always one.
    uint256 public publicLimit = 3;
    uint256 public totalMinted;

    mapping(address => bool) public mintedAllowlist;
    mapping(address => uint256) public mintedPublic;

    /// @notice tokenId -> artwork (1..180), assigned at mint. Zero until minted.
    mapping(uint256 => uint256) public artworkOf;

    /// @dev Lazy Fisher-Yates. _slot holds value+1 so that zero means "never
    ///      touched, still the identity". Each mint swaps the drawn index with
    ///      the last live one and shrinks the pool, which gives a real
    ///      permutation without ever writing a 180-entry array.
    mapping(uint256 => uint256) private _slot;
    uint256 private _remaining = MAX_SUPPLY;

    error WrongPhase();
    error SoldOut();
    error BadProof();
    error AlreadyClaimed();
    error LimitReached();
    error WrongPayment();
    error NothingToWithdraw();
    error TransferFailed();
    error NonexistentToken();


    event PhaseSet(Phase phase);

    event Minted(address indexed to, uint256 indexed tokenId, uint256 artwork);

    constructor(address glyphsAddress, address owner_) ERC721("What Do I Get, 1978", "WDIG78") Ownable(owner_) {
        glyphs = Glyphs(glyphsAddress);
        // 1.978% to the owner - see _feeDenominator for why 1978.
        _setDefaultRoyalty(owner_, 1978);
    }

    // --- minting ------------------------------------------------------------

    /// @notice Free, one per wallet, for addresses in the allowlist.
    function mintAllowlist(bytes32[] calldata proof) external {
        if (phase != Phase.Allowlist) revert WrongPhase();
        if (mintedAllowlist[msg.sender]) revert AlreadyClaimed();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verifyCalldata(proof, allowlistRoot, leaf)) revert BadProof();

        mintedAllowlist[msg.sender] = true;
        _mintNext(msg.sender);
    }

    /// @notice Paid, capped per wallet.
    function mintPublic(uint256 quantity) external payable {
        if (phase != Phase.Public) revert WrongPhase();
        if (quantity == 0) revert LimitReached();
        if (mintedPublic[msg.sender] + quantity > publicLimit) revert LimitReached();
        if (msg.value != price * quantity) revert WrongPayment();

        mintedPublic[msg.sender] += quantity;
        for (uint256 i; i < quantity; ++i) {
            _mintNext(msg.sender);
        }
    }

    function _mintNext(address to) private {
        uint256 id = totalMinted + 1;
        if (id > MAX_SUPPLY) revert SoldOut();
        totalMinted = id;
        artworkOf[id] = _draw(to, id);
        _safeMint(to, id);
        emit Minted(to, id, artworkOf[id]);
    }

    /// @dev Draw one artwork from those still unassigned.
    ///
    ///      The seed mixes prevrandao with the minter and the token id. Be clear
    ///      about what that is worth: a block proposer can influence prevrandao
    ///      and could re-roll a mint in the same block. For an art edition that
    ///      is an acceptable trade against the cost and delay of a VRF - but it
    ///      is NOT a guarantee against a determined, well-resourced proposer,
    ///      and it should not be described as one.
    function _draw(address to, uint256 id) private returns (uint256) {
        uint256 n = _remaining;
        uint256 i = uint256(keccak256(abi.encodePacked(block.prevrandao, to, id, n))) % n;

        uint256 rawPick = _slot[i];
        uint256 picked = rawPick == 0 ? i : rawPick - 1;

        uint256 lastIndex = n - 1;
        uint256 rawLast = _slot[lastIndex];
        _slot[i] = (rawLast == 0 ? lastIndex : rawLast - 1) + 1;
        if (rawLast != 0) delete _slot[lastIndex];

        _remaining = lastIndex;
        return picked + 1;
    }

    /// @notice How many artworks are still unassigned.
    function remaining() external view returns (uint256) {
        return _remaining;
    }

    /// @notice Whether `account` is in the current allowlist.
    function isAllowlisted(address account, bytes32[] calldata proof) external view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account))));
        return MerkleProof.verifyCalldata(proof, allowlistRoot, leaf);
    }

    // --- owner --------------------------------------------------------------

    function setPhase(Phase p) external onlyOwner {
        phase = p;
        emit PhaseSet(p);
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        allowlistRoot = root;
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
    }

    function setPublicLimit(uint256 limit) external onlyOwner {
        publicLimit = limit;
    }

    function setRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function withdraw(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool ok,) = to.call{value: balance}("");
        if (!ok) revert TransferFailed();
    }

    // --- rendering ----------------------------------------------------------

    string private constant PAPER = "#ece4d4";
    string private constant INK = "#16202b";
    string private constant SPOT = "#e2482b";

    /// @notice Artwork `index` (1..180) as a standalone SVG. Independent of
    ///         minting, so the whole catalogue can be read off chain at any time.
    function renderArtwork(uint256 index) public view returns (string memory) {
        uint256 p = RenderData.packed(index);

        uint256 poly = (p >> 93) & 0x7;
        bool inkRed = ((p >> 92) & 0x1) == 1;
        uint256 glyph = (p >> 84) & 0xFF;

        string memory head = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">'
            '<rect width="1000" height="1000" fill="',
            PAPER,
            '"/><polygon points="',
            RenderData.whitePoly(poly),
            '" fill="',
            PAPER,
            '"/><polygon points="',
            RenderData.inkPoly(poly),
            '" fill="',
            inkRed ? SPOT : INK,
            '"/>'
        );

        if (glyph == 255) return string.concat(head, "</svg>");

        uint256 fill = (p >> 82) & 0x3;
        uint256 rot = (p >> 80) & 0x3;
        uint256 x = (p >> 63) & 0x1FFFF;
        uint256 y = (p >> 46) & 0x1FFFF;
        uint256 scale = p & 0x7FFFFFFF;

        return string.concat(
            head,
            '<g transform="translate(',
            _dec(x, 2),
            " ",
            _dec(y, 2),
            ") rotate(",
            (rot * 90).toString(),
            ')"><g transform="scale(',
            _dec(scale, 6),
            ')"><path d="',
            glyphs.path(glyph),
            '" fill="',
            fill == 0 ? INK : (fill == 1 ? PAPER : SPOT),
            '" fill-rule="evenodd"/></g></g></svg>'
        );
    }

    /// @notice The artwork a minted token holds.
    function renderSVG(uint256 tokenId) public view returns (string memory) {
        uint256 art = artworkOf[tokenId];
        if (art == 0) revert NonexistentToken();
        return renderArtwork(art);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory json = string.concat(
            '{"name":"What Do I Get, 1978 #',
            tokenId.toString(),
            '","description":"What Do I Get, 1978 - one square of the Buzzcocks promo poster for \\"What Do I Get?\\" '
            "(United Artists UP 36348, 1978), designed by Malcolm Garrett. Every parameter is measured from the source: "
            'one cut at 21.4 degrees, eight orientations, six words, three planes. 180 items, no duplicates.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(renderSVG(tokenId))),
            '","attributes":',
            _attributes(tokenId),
            "}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _attributes(uint256 tokenId) private view returns (string memory) {
        uint256 a = RenderData.traits(artworkOf[tokenId]);
        uint256 rot = (a >> 9) & 0x3;
        bool mirror = ((a >> 8) & 0x1) == 1;
        uint256 word = (a >> 5) & 0x7;
        uint256 plane = (a >> 3) & 0x3;
        uint256 plate = (a >> 1) & 0x3;
        bool provenance = (a & 0x1) == 1;

        string memory out = string.concat(
            '[{"trait_type":"Plate","value":"',
            _plate(plate),
            '"},{"trait_type":"Word","value":"',
            _word(word),
            '"},{"trait_type":"Plane","value":"',
            plane == 3 ? "None" : (plane == 0 ? "A" : (plane == 1 ? "B" : "C")),
            '"},{"trait_type":"Rotation","value":"',
            (rot * 90).toString(),
            unicode'°"},{"trait_type":"Mirror","value":"',
            mirror ? "Mirrored" : "As Cut",
            '"}'
        );
        if (provenance) {
            out = string.concat(out, ',{"trait_type":"Provenance","value":"Malcolm Garrett 1978"}');
        }
        return string.concat(out, "]");
    }

    function _plate(uint256 i) private pure returns (string memory) {
        if (i == 0) return "Blue";
        if (i == 1) return "Red";
        if (i == 2) return "Inverted";
        return "Red Inverted";
    }

    function _word(uint256 i) private pure returns (string memory) {
        if (i == 0) return "WHAT";
        if (i == 1) return "DO";
        if (i == 2) return "I";
        if (i == 3) return "GET?";
        if (i == 4) return "BUZZCOCKS";
        if (i == 5) return "UP 36348";
        return "Blank";
    }

    /// @dev Render `value / 10**decimals` the way JavaScript's Number#toString
    ///      does: no trailing zeros, and no decimal point when the fraction is
    ///      empty. The on-chain SVG has to match the renderer byte for byte, and
    ///      "963.00" instead of "963" would break that.
    function _dec(uint256 value, uint256 decimals) private pure returns (string memory) {
        uint256 unit = 10 ** decimals;
        uint256 whole = value / unit;
        uint256 frac = value % unit;
        if (frac == 0) return whole.toString();

        bytes memory f = new bytes(decimals);
        for (uint256 i = decimals; i > 0; --i) {
            f[i - 1] = bytes1(uint8(48 + (frac % 10)));
            frac /= 10;
        }
        uint256 end = decimals;
        while (end > 0 && f[end - 1] == "0") --end;

        bytes memory trimmed = new bytes(end);
        for (uint256 i; i < end; ++i) {
            trimmed[i] = f[i];
        }
        return string.concat(whole.toString(), ".", string(trimmed));
    }

    // --- plumbing -----------------------------------------------------------

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @dev ERC-2981 defaults to basis points, where 1.978% would be 197.8 - not
    ///      an integer, so it cannot be expressed. Scaling the denominator by ten
    ///      makes the rate exact rather than rounded: 1978 / 100000 = 1.978%.
    function _feeDenominator() internal pure override returns (uint96) {
        return 100_000;
    }
}
