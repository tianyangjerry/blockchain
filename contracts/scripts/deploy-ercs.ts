import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  // ERC20
  const ERC20F = await ethers.getContractFactory("SampleERC20");
  const erc20 = await ERC20F.deploy("SampleToken", "STK", ethers.parseEther("1000000"));
  await erc20.deployed();
  console.log("ERC20:", erc20.address);

  // ERC721
  const ERC721F = await ethers.getContractFactory("SampleERC721");
  const erc721 = await ERC721F.deploy("SampleNFT", "SNFT");
  await erc721.deployed();
  console.log("ERC721:", erc721.address);

  // ERC1155
  const ERC1155F = await ethers.getContractFactory("SampleERC1155");
  const erc1155 = await ERC1155F.deploy("https://example.com/{id}.json");
  await erc1155.deployed();
  console.log("ERC1155:", erc1155.address);
}

main().catch((e) => { console.error(e); process.exit(1); });


