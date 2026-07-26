// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WhatDoIGet1978} from "../src/WhatDoIGet1978.sol";
import {Glyphs} from "../src/Glyphs.sol";

/// @notice Deploys the glyph data contract, then the minter pointed at it.
///
/// Sepolia:
///   export SEPOLIA_RPC_URL=...
///   export PRIVATE_KEY=...
///   export OWNER=0x...            # owner + royalty receiver; defaults to the deployer
///   forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
///
/// The contract opens Closed. Nothing can be minted until the owner sets the
/// allowlist root and moves the phase on.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address owner = vm.envOr("OWNER", deployer);

        vm.startBroadcast(pk);
        Glyphs glyphs = new Glyphs();
        WhatDoIGet1978 nft = new WhatDoIGet1978(address(glyphs), owner);
        vm.stopBroadcast();

        console.log("Glyphs          ", address(glyphs));
        console.log("WhatDoIGet1978  ", address(nft));
        console.log("owner           ", owner);
        console.log("phase           ", "Closed - set the root, then setPhase(1)");

        // Fail loudly here rather than after a real deploy: if the renderer is
        // broken on chain, the art is wrong and no amount of front end fixes it.
        string memory svg = nft.renderSVG(1);
        require(bytes(svg).length > 0, "renderer returned nothing");
        console.log("token 1 SVG     ", bytes(svg).length, "bytes");
    }
}
