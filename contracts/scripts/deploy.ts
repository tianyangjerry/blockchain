import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", await deployer.getAddress());
    const Factory = await ethers.getContractFactory("SimpleRegistry");
    const contract = await Factory.deploy();
    await contract.deployed();
    console.log("SimpleRegistry deployed:", contract.address);
    console.log("tx:", contract.deployTransaction.hash);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
