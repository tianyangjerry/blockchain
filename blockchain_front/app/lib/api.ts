export interface ContractRecord {
    name: string;
    address: string;
    abi: string; // JSON string
    network?: string;
    txHash?: string;
    createdAt?: string;
}

// 募捐相关类型（前端预置，后端将提供相应接口）
export interface Campaign {
    id: string;
    title: string;
    description: string;
    goalAmount: string; // 目标金额（字符串，便于大数处理）
    raisedAmount: string; // 已筹集金额
    image?: string;
    owner?: string;
    status?: "active" | "completed" | "upcoming";
    // 新增限制类字段（后端已支持）
    minDonation?: string;
    startAt?: string;
    endAt?: string;
    capAmount?: string;
    withdrawnAmount?: string;
    createdAt?: string;
}

export interface Donation {
    id: string;
    campaignId: string;
    donor: string;
    amount: string; // 金额（字符串）
    txHash?: string;
    timestamp: string;
    token?: string; // 代币符号（如 ETH、USDC）
}

export interface RewardConfig {
    id: string;
    pointPerETH: string;
    nftThresholdsJson: string;
    dailyCapPerAddress: string;
    cooldownSeconds: number;
    updatedAt?: string;
}

export interface LeaderboardEntry {
    donor: string;
    totalEth: string;
    totalPoints: string;
}

export interface OrgApplication {
    address: string;
    orgName: string;
    docs?: string;
    status: string;
    createdAt?: string;
    decidedAt?: string;
}

export interface AnalyticsSummary {
    totalAmount: string;
    totalDonations: number;
    totalCampaigns: number;
    activeCampaigns: number;
}
export interface DailyPoint {
    date: string;
    amount: string;
    count: number;
}

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
        cache: "no-store",
    });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if ((data as any)?.error) msg = (data as any).error;
        } catch {}
        throw new Error(msg);
    }
    return res.json();
}

export const api = {
    async sendEmailCode(email: string): Promise<{ status: string }> {
        return request<{ status: string }>("/api/auth/email/send", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    },
    async verifyEmailCode(
        email: string,
        code: string
    ): Promise<{ status: string }> {
        return request<{ status: string }>("/api/auth/email/verify", {
            method: "POST",
            body: JSON.stringify({ email, code }),
        });
    },
    async listContracts(): Promise<ContractRecord[]> {
        return request<ContractRecord[]>("/api/contracts");
    },
    async listTemplates(): Promise<{ name: string }[]> {
        return request<{ name: string }[]>("/api/contracts/templates");
    },
    async getTemplate(name: string): Promise<{
        name: string;
        abi: any;
        bytecode: string;
        constructorArgsExample?: any[];
    }> {
        return request(`/api/contracts/template/${name}`);
    },
    async getContract(address: string): Promise<ContractRecord> {
        return request<ContractRecord>(`/api/contracts/${address}`);
    },
    async createContract(rec: ContractRecord): Promise<ContractRecord> {
        return request<ContractRecord>("/api/contracts", {
            method: "POST",
            body: JSON.stringify(rec),
        });
    },
    async deploy(payload: {
        name: string;
        abi: string;
        bytecode: string;
        constructorArgs?: unknown[];
        network?: string;
    }): Promise<ContractRecord> {
        return request<ContractRecord>("/api/contracts/deploy", {
            method: "POST",
            body: JSON.stringify({
                name: payload.name,
                abi: payload.abi,
                bytecode: payload.bytecode,
                constructorArgs: payload.constructorArgs ?? [],
                network: payload.network ?? "",
            }),
        });
    },
    async registerBind(
        email: string,
        address: string
    ): Promise<{ status: string }> {
        return request<{ status: string }>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, address }),
        });
    },

    // 募捐项目列表
    async listCampaigns(): Promise<Campaign[]> {
        const res = await request<any>("/api/campaigns");
        return Array.isArray(res) ? (res as Campaign[]) : [];
    },

    // 募捐项目详情（含最近捐赠）
    async getCampaign(
        id: string
    ): Promise<Campaign & { donations?: Donation[] }> {
        const res = await request<any>(`/api/campaigns/${id}`);
        if (res && typeof res === "object") {
            if (!Array.isArray(res.donations)) res.donations = [];
            if (!Array.isArray(res.updates)) res.updates = [];
        }
        return res as Campaign & { donations?: Donation[] };
    },

    async createCampaign(payload: {
        id: string;
        title: string;
        description: string;
        goalAmount: string;
        image?: string;
        owner?: string;
        status?: string;
        beneficiary?: string;
    }): Promise<Campaign> {
        return request<Campaign>("/api/campaigns", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async withdrawCampaign(
        id: string,
        amount: string
    ): Promise<{ status: string }> {
        return request<{ status: string }>(`/api/campaigns/${id}/withdraw`, {
            method: "POST",
            body: JSON.stringify({ amount }),
        });
    },

    // 奖励配置
    async getRewardConfig(): Promise<RewardConfig> {
        return request<RewardConfig>("/api/rewards/config");
    },
    async updateRewardConfig(
        cfg: Omit<RewardConfig, "id" | "updatedAt">
    ): Promise<RewardConfig> {
        return request<RewardConfig>("/api/rewards/config", {
            method: "POST",
            body: JSON.stringify(cfg),
        });
    },
    async getLeaderboard(): Promise<LeaderboardEntry[]> {
        return request<LeaderboardEntry[]>("/api/rewards/leaderboard");
    },
    async getBadges(address: string): Promise<{
        address: string;
        totalEth: string;
        totalPoints: string;
        badges: string[];
    }> {
        return request(`/api/rewards/badges/${address}`);
    },
    // 机构审核
    async listOrgApplications(status?: string): Promise<OrgApplication[]> {
        const q = status ? `?status=${encodeURIComponent(status)}` : "";
        return request<OrgApplication[]>(`/api/org/list${q}`);
    },
    async approveOrg(
        address: string,
        status: "approved" | "rejected" = "approved"
    ): Promise<{ status: string }> {
        return request<{ status: string }>(`/api/org/approve`, {
            method: "POST",
            body: JSON.stringify({ address, status }),
        });
    },

    async queryDonations(params: {
        address?: string;
        campaignId?: string;
        from?: string;
        to?: string;
        page?: number;
        pageSize?: number;
    }): Promise<Donation[]> {
        const q = new URLSearchParams();
        if (params.address) q.set("address", params.address);
        if (params.campaignId) q.set("campaignId", params.campaignId);
        if (params.from) q.set("from", params.from);
        if (params.to) q.set("to", params.to);
        if (params.page) q.set("page", String(params.page));
        if (params.pageSize) q.set("pageSize", String(params.pageSize));
        const qs = q.toString();
        return request<Donation[]>(`/api/donations${qs ? `?${qs}` : ""}`);
    },

    async getAnalyticsSummary(): Promise<AnalyticsSummary> {
        return request<AnalyticsSummary>("/api/analytics/summary");
    },
    async getAnalyticsDaily(days = 30): Promise<DailyPoint[]> {
        return request<DailyPoint[]>(`/api/analytics/daily?days=${days}`);
    },
    async getAnalyticsTop(
        type: "campaign" | "donor" = "campaign",
        limit = 10
    ): Promise<{ key: string; total: string }[]> {
        return request<{ key: string; total: string }[]>(
            `/api/analytics/top?type=${type}&limit=${limit}`
        );
    },
    async getAnalyticsGas(
        limit = 30
    ): Promise<{
        sample: number;
        avgGasUsed: string;
        avgGasPriceGwei: string;
        avgFeeETH: string;
    }> {
        return request(`/api/analytics/gas?limit=${limit}`);
    },
};
