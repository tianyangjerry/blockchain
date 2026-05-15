import { ethers } from "hardhat";

// Minimal DTOs matching backend API
type CampaignDTO = {
    id: string;
    title: string;
    description: string;
    goalAmount: string;
    image?: string;
    owner?: string;
    status?: string;
    beneficiary?: string;
};

// Util: fetch (Node 18+). Keep any-typed to avoid TS lib DOM requirements
const fetchAny: any = (globalThis as any).fetch;

function toWei(eth: string) {
    return ethers.parseEther(eth);
}

function randEth(min = 0.005, max = 0.2) {
    const v = Math.random() * (max - min) + min;
    return v.toFixed(6);
}

function shaId(id: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(id));
}

async function loginAsAdmin(backendBase: string, signer: any): Promise<string> {
    const address = await signer.getAddress();
    const r1 = await fetchAny(`${backendBase}/api/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
    });
    if (!r1.ok) throw new Error(`nonce http ${r1.status}`);
    const { nonce } = await r1.json();
    const signature = await signer.signMessage(`Login:${nonce}`);
    const r2 = await fetchAny(`${backendBase}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Address: address, Signature: signature }),
    });
    if (!r2.ok) throw new Error(`verify http ${r2.status}`);
    const { token } = await r2.json();
    return token as string;
}

async function createCampaignRecord(
    backendBase: string,
    token: string,
    dto: CampaignDTO
) {
    const r = await fetchAny(`${backendBase}/api/campaigns`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
    });
    if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`createCampaign(${dto.id}) http ${r.status} ${text}`);
    }
}

async function main() {
    const BACKEND = process.env.BACKEND_BASE || "http://localhost:8080";
    const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
    const NUM_CAMPAIGNS = parseInt(process.env.SEED_CAMPAIGNS || "10");
    const DONATIONS_PER_CAMPAIGN = parseInt(process.env.SEED_DONATIONS || "50");
    const DONORS_PER_TX = parseInt(process.env.SEED_DONORS_PER_TX || "1");
    const CONCURRENCY = parseInt(process.env.SEED_CONCURRENCY || "10");

    console.log("Seed config:", {
        BACKEND,
        RPC,
        NUM_CAMPAIGNS,
        DONATIONS_PER_CAMPAIGN,
    });

    // Get signers from current network (Ganache should expose unlocked accounts)
    const signers = await ethers.getSigners();
    if (signers.length < 3)
        throw new Error("需要至少 3 个账户用于部署/受益人/捐赠者");

    // 1) Deploy or attach donation contract
    const deployer = signers[0];
    const existAddr = process.env.DONATION_CONTRACT_ADDRESS?.trim();
    let donation: any;
    if (existAddr) {
        donation = await ethers.getContractAt(
            "DonationCampaigns",
            existAddr,
            deployer
        );
        console.log("Using existing DonationCampaigns:", existAddr);
    } else {
        const Factory = await ethers.getContractFactory(
            "DonationCampaigns",
            deployer
        );
        donation = await Factory.deploy();
        await donation.deployed();
        console.log("DonationCampaigns deployed:", donation.address);
        // Print helper for env export
        console.log(`DONATION_CONTRACT_ADDRESS=${donation.address}`);
    }

    // 2) Admin login to backend (address must be in ADMIN_ADDRESSES)
    let adminToken = "";
    try {
        adminToken = await loginAsAdmin(BACKEND, deployer);
        console.log("Admin JWT acquired.");
    } catch (e) {
        console.warn(
            "管理员登录失败（将跳过创建后端项目记录，仅造链上数据）:",
            (e as Error).message
        );
    }

    // 简易并发限制器（不引入依赖）
    const createLimiter = (limit: number) => {
        let active = 0;
        const queue: (() => void)[] = [];
        const next = () => {
            const fn = queue.shift();
            if (fn) fn();
        };
        return async function run<T>(fn: () => Promise<T>): Promise<T> {
            if (active >= limit)
                await new Promise<void>((res) => queue.push(res));
            active++;
            try {
                return await fn();
            } finally {
                active--;
                next();
            }
        };
    };

    const limit = createLimiter(CONCURRENCY);

    // 3) Create campaigns on-chain and (optionally) in backend DB
    const beneficiaries = signers.slice(1, Math.min(6, signers.length));
    const campaignIds: string[] = [];
    {
        const tasks: Promise<void>[] = [];
        for (let i = 0; i < NUM_CAMPAIGNS; i++) {
            tasks.push(
                limit(async () => {
                    const id = `camp-${i.toString().padStart(4, "0")}`;
                    const idHash = shaId(id);
                    const beneficiary = await beneficiaries[
                        i % beneficiaries.length
                    ].getAddress();
                    const goalEth = (Math.random() * 100 + 10).toFixed(2);
                    const tx = await donation.createCampaign(
                        idHash,
                        beneficiary,
                        toWei(goalEth)
                    );
                    await tx.wait();
                    campaignIds.push(id);
                    if (adminToken) {
                        await createCampaignRecord(BACKEND, adminToken, {
                            id,
                            title: `公益项目 #${i}`,
                            description: `这是第 ${i} 个自动生成的公益募捐项目。`,
                            goalAmount: goalEth,
                            owner: await deployer.getAddress(),
                            status: "active",
                            beneficiary,
                        });
                    }
                })
            );
        }
        await Promise.all(tasks);
        console.log(`Created ${campaignIds.length}/${NUM_CAMPAIGNS} campaigns`);
    }

    // 4) Generate donations
    const donorSigners = signers.slice(2);
    let donationCount = 0;
    for (let i = 0; i < campaignIds.length; i++) {
        const id = campaignIds[i];
        const idHash = shaId(id);
        const inner: Promise<void>[] = [];
        for (let j = 0; j < DONATIONS_PER_CAMPAIGN; j++) {
            inner.push(
                limit(async () => {
                    const donor =
                        donorSigners[
                            (i * DONATIONS_PER_CAMPAIGN + j) %
                                donorSigners.length
                        ];
                    const amount = randEth();
                    const c = donation.connect(donor);
                    const tx = await c.donateETH(idHash, {
                        value: toWei(amount),
                    });
                    await tx.wait();
                    donationCount++;
                    if (donationCount % 200 === 0) {
                        console.log(`donations: ${donationCount}`);
                    }
                })
            );
        }
        await Promise.all(inner);
    }

    console.log("Seed completed:", {
        campaigns: NUM_CAMPAIGNS,
        donations: donationCount,
    });
    console.log(
        "提示: 将 DONATION_CONTRACT_ADDRESS 设置为上述地址并重启后端以启动链上监听。"
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
