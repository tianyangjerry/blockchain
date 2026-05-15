import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", await deployer.getAddress());

    const Factory = await ethers.getContractFactory("DonationCampaigns");
    const donation = await Factory.deploy();
    await donation.waitForDeployment();

    const addr = await donation.getAddress();
    const tx = donation.deploymentTransaction()?.hash || "";
    console.log("DonationCampaigns deployed:", addr);
    if (tx) console.log("tx:", tx);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
