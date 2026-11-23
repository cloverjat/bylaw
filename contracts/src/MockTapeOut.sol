// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev TEST ONLY. Interprets NAND netlists in the TapeOut byte format so tests can run without X Layer.
contract MockTapeOut {
    mapping(uint256 => bytes) public nl;
    mapping(uint256 => uint8) public nIns;
    mapping(uint256 => uint8) public nOuts;

    function register(uint256 id, bytes calldata netlist_, uint8 nIn, uint8 nOut) external {
        nl[id] = netlist_;
        nIns[id] = nIn;
        nOuts[id] = nOut;
    }

    function netlist(uint256 id) external view returns (bytes memory) {
        return nl[id];
    }

    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory) {
        bytes memory n = nl[id];
        uint256 nIn = nIns[id];
        uint256 nOut = nOuts[id];
        uint256 g = n.length / 7;
        bytes memory sig = new bytes(2 + nIn + g);
        sig[1] = 0x01;
        for (uint256 i = 0; i < nIn; i++) {
            sig[2 + i] = bytes1((uint8(inputs[i >> 3]) >> (i & 7)) & 1);
        }
        for (uint256 k = 0; k < g; k++) {
            uint256 o = k * 7;
            require(uint8(n[o]) == 0, "nand only");
            uint256 a = (uint256(uint8(n[o + 1])) << 16) | (uint256(uint8(n[o + 2])) << 8) | uint8(n[o + 3]);
            uint256 b = (uint256(uint8(n[o + 4])) << 16) | (uint256(uint8(n[o + 5])) << 8) | uint8(n[o + 6]);
            require(a < 2 + nIn + k && b < 2 + nIn + k, "future signal");
            sig[2 + nIn + k] = bytes1((uint8(sig[a]) & uint8(sig[b])) ^ 1);
        }
        bytes memory out = new bytes((nOut + 7) / 8);
        for (uint256 j = 0; j < nOut; j++) {
            uint8 bit = uint8(sig[sig.length - nOut + j]);
            out[j >> 3] = bytes1(uint8(out[j >> 3]) | (bit << (j & 7)));
        }
        return out;
    }
}
