// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DonationCampaigns
 * @notice 支持以 bytes32 ID（建议前端使用 keccak256(UTF8(id))）标识的募捐项目。
 *         允许捐赠 ETH 与 ERC20；记录事件；受益人可提现。
 */
contract DonationCampaigns is Ownable {
    struct Campaign {
        address beneficiary;
        uint256 goal;
        uint256 raised;
        bool exists;
    }

    mapping(bytes32 => Campaign) public campaigns;

    event CampaignCreated(bytes32 indexed id, address indexed beneficiary, uint256 goal);
    event DonationReceived(bytes32 indexed id, address indexed donor, address indexed token, uint256 amount);
    event Withdrawn(bytes32 indexed id, address indexed to, address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function createCampaign(bytes32 id, address beneficiary, uint256 goal) external onlyOwner {
        require(beneficiary != address(0), "bad beneficiary");
        require(!campaigns[id].exists, "exists");
        campaigns[id] = Campaign({ beneficiary: beneficiary, goal: goal, raised: 0, exists: true });
        emit CampaignCreated(id, beneficiary, goal);
    }

    function donateETH(bytes32 id) external payable {
        Campaign storage c = campaigns[id];
        require(c.exists, "no campaign");
        require(msg.value > 0, "zero");
        c.raised += msg.value;
        emit DonationReceived(id, msg.sender, address(0), msg.value);
    }

    function donateERC20(bytes32 id, address token, uint256 amount) external {
        Campaign storage c = campaigns[id];
        require(c.exists, "no campaign");
        require(amount > 0, "zero");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transferFrom fail");
        c.raised += amount;
        emit DonationReceived(id, msg.sender, token, amount);
    }

    function withdrawETH(bytes32 id, uint256 amount) external {
        Campaign storage c = campaigns[id];
        require(c.exists, "no campaign");
        require(msg.sender == c.beneficiary || msg.sender == owner(), "no auth");
        require(address(this).balance >= amount, "insufficient ETH");
        (bool ok, ) = c.beneficiary.call{ value: amount }("");
        require(ok, "send fail");
        emit Withdrawn(id, c.beneficiary, address(0), amount);
    }

    function withdrawERC20(bytes32 id, address token, uint256 amount) external {
        Campaign storage c = campaigns[id];
        require(c.exists, "no campaign");
        require(msg.sender == c.beneficiary || msg.sender == owner(), "no auth");
        require(IERC20(token).transfer(c.beneficiary, amount), "transfer fail");
        emit Withdrawn(id, c.beneficiary, token, amount);
    }
}


