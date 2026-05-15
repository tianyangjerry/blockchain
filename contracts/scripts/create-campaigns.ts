import { ethers } from "hardhat";

function toWei(eth: string) {
    return ethers.parseEther(eth);
}

async function main() {
    const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
    const idsCsv = (process.env.CAMPAIGN_IDS || "").trim();
    if (!idsCsv) throw new Error("CAMPAIGN_IDS required (comma-separated)");
    const ids = idsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const signers = await ethers.getSigners();
    if (signers.length === 0) throw new Error("no signers");
    const deployer = signers[0];

    const addr = process.env.DONATION_CONTRACT_ADDRESS?.trim();
    if (!addr) throw new Error("DONATION_CONTRACT_ADDRESS required");
    const donation = await ethers.getContractAt(
        "DonationCampaigns",
        addr,
        deployer
    );

    const beneficiary =
        process.env.BENEFICIARY || (await deployer.getAddress());
    for (const id of ids) {
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(id));
        const goal = toWei(String(Math.floor(Math.random() * 900 + 100))); // 100~1000 ETH
        try {
            const tx = await donation.createCampaign(idHash, beneficiary, goal);
            await tx.wait();
            console.log(`created ${id} -> ${idHash}`);
        } catch (e: any) {
            console.log(`skip ${id}: ${e?.message || e}`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
