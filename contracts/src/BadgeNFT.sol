// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BadgeNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdSeq;

    constructor() ERC721("CharityBadge", "CBADGE") Ownable(msg.sender) {}

    function safeMint(address to, string memory uri) external onlyOwner returns (uint256 tokenId) {
        _tokenIdSeq += 1;
        tokenId = _tokenIdSeq;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }
}


