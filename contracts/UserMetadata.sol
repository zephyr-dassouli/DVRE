// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract UserMetadata {
    address public owner;
    string public email;
    string public name;
    string public institution;

    constructor(
        address _owner,
        string memory _email,
        string memory _name,
        string memory _institution
    ) {
        owner = _owner;
        email = _email;
        name = _name;
        institution = _institution;
    }

    function getMetadataJSON() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '{"wallet":"',
                    toAsciiString(owner),
                    '","email":"',
                    email,
                    '","name":"',
                    name,
                    '","institution":"',
                    institution,
                    '"}'
                )
            );
    }

    // Helper to convert address to string
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2 ** (8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i + 2] = char(hi);
            s[2 * i + 3] = char(lo);
        }
        return string(s);
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
