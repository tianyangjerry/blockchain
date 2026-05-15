// @ts-nocheck
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", await deployer.getAddress());
    // prefer PRIVATE_KEY from env so ownership与后端一致
    const priv = (process.env.PRIVATE_KEY || "").replace(/^0x/, "");
    let signer: any = deployer;
    if (priv) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Wallet } = require("ethers");
        signer = new Wallet("0x" + priv, ethers.provider);
        console.log("Using PK signer:", await signer.getAddress());
    }
    const Factory = await ethers.getContractFactory("BadgeNFT", signer);
    const badge = await Factory.deploy();
    await (badge as any).waitForDeployment?.();
    const addr = (badge as any).getAddress
        ? await (badge as any).getAddress()
        : (badge as any).address;
    console.log("BadgeNFT:", addr);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
