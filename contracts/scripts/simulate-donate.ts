import { ethers } from "hardhat";

type CampaignDTO = { id: string };
const fetchAny: any = (globalThis as any).fetch;

function toWei(eth: string) {
    return ethers.parseEther(eth);
}
function randEth(min = 0.005, max = 0.2) {
    const v = Math.random() * (max - min) + min;
    return v.toFixed(6);
}

async function main() {
    const BACKEND = process.env.BACKEND_BASE || "http://backend:8080";
    const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
    const ADDR = process.env.DONATION_CONTRACT_ADDRESS || "";
    const TOTAL = parseInt(process.env.TOTAL_TX || "200");
    const CONC = parseInt(process.env.CONCURRENCY || "40");
    const IDS_ENV = (process.env.CAMPAIGN_IDS || "").trim();

    if (!ADDR) throw new Error("DONATION_CONTRACT_ADDRESS required");

    console.log("simulate config", { BACKEND, RPC, TOTAL, CONC, ADDR });
    const signers = await ethers.getSigners();
    if (signers.length < 3) throw new Error("need at least 3 signers");
    const deployer = signers[0];
    const donation = await ethers.getContractAt(
        "DonationCampaigns",
        ADDR,
        deployer
    );

    let ids: string[] = [];
    if (IDS_ENV) {
        ids = IDS_ENV.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    } else {
        try {
            const list: CampaignDTO[] = await (
                await fetchAny(`${BACKEND}/api/campaigns`)
            ).json();
            ids = (list || []).slice(0, 10).map((c: any) => c.id);
        } catch {
            /* ignore */
        }
    }
    if (ids.length === 0) throw new Error("no campaign ids found");

    // Ensure campaigns exist on chain
    for (const id of ids) {
        const idHash = ethers.keccak256(ethers.toUtf8Bytes(id));
        try {
            const goal = toWei(String(Math.floor(Math.random() * 900 + 100)));
            const beneficiary = await signers[1].getAddress();
            const tx = await donation.createCampaign(idHash, beneficiary, goal);
            await tx.wait();
            console.log("created", id);
        } catch (e: any) {
            const msg = (e?.message || "").toLowerCase();
            if (msg.includes("exists")) {
                console.log("exists", id);
            } else {
                console.log("create skip", id, msg);
            }
        }
    }

    // Simple limiter
    let active = 0;
    const queue: (() => Promise<void>)[] = [];
    function push(task: () => Promise<void>) {
        queue.push(task);
    }
    async function runAll(limit: number) {
        return new Promise<void>((resolve) => {
            const next = () => {
                while (active < limit && queue.length) {
                    const t = queue.shift()!;
                    active++;
                    t().finally(() => {
                        active--;
                        next();
                    });
                }
                if (active === 0 && queue.length === 0) resolve();
            };
            next();
        });
    }

    const donors = signers.slice(2);
    let sent = 0;
    for (let i = 0; i < TOTAL; i++) {
        push(async () => {
            const idx = i % ids.length;
            const id = ids[idx];
            const idHash = ethers.keccak256(ethers.toUtf8Bytes(id));
            const donor = donors[(i + 7) % donors.length];
            const amt = randEth();
            const tx = await donation
                .connect(donor)
                .donateETH(idHash, { value: toWei(amt) });
            await tx.wait();
            sent++;
            if (sent % 50 === 0) console.log("sent", sent);
        });
    }
    await runAll(CONC);
    console.log("simulate done", { sent });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
