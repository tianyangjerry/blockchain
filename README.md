区块链合约运营平台（Monorepo）

概览
本项目是一个包含前端（Next.js + TanStack Query）与后端（Go + PostgreSQL）的区块链合约运营平台，支持：

-   邮箱 + 钱包的注册/登录与权限控制（管理员/用户/公益机构）
-   合约模板与 artifact 上传，后端代签名部署（可配置 RPC 与私钥）
-   募捐项目（Campaign）：支持最小捐赠、开始/结束时间、金额上限（cap），自动完结
-   捐赠：ETH/ERC20，链上事件监听回填；“我的捐赠”查询/导出
-   奖励：积分与 NFT 徽章阈值配置、排行榜与个人徽章查询、可选上链铸造
-   公益机构申请与管理员审核
-   管理端：项目创建/提现、奖励配置、SMTP 检测与测试、数据分析（KPI/趋势/排行/Gas 概览）
-   合约清单、详情、方法读写交互
-   Docker Compose 一键启动

目录结构

-   Blockchain-backend/：Go 后端服务
-   blockchain_front/：Next.js 前端应用
-   contracts/：Hardhat 合约工程（用于本地编译与生成 artifact）
-   docker-compose.yml：容器编排

快速开始

1. 准备环境

-   安装 Docker 与 Docker Compose
-   准备 PostgreSQL（Compose 会自动启动）
-   获取本地链（anvil/Hardhat）或外部 RPC，准备部署私钥（测试私钥）

2. 配置环境变量（关键）

-   后端（Compose 会在 backend 容器中传入）：
    -   PG_DSN：PostgreSQL 连接串（如 postgres://user:pass@db:5432/app?sslmode=disable）
    -   RPC_URL：区块链节点 RPC（如 http://anvil:8545）
    -   PRIVATE_KEY：用于部署合约的私钥（0x 前缀或不带均可）
    -   AUTH_SECRET：JWT 签名密钥
    -   ADMIN_ADDRESSES：管理员地址列表，逗号分隔
-   事件监听（可选）：

    -   DONATION_CONTRACT_ADDRESS：`DonationCampaigns` 合约地址
    -   RPC_URL：需指向同链节点（与上相同）
    -   DONATION_START_BLOCK：起始区块（可选，默认从 0）

    -   SMTP\_\*：可选邮箱发信配置（未配置则以日志代替）

-   前端：
    -   NEXT_PUBLIC_API_BASE_URL：后端基础地址（开发默认 http://localhost:8080）
    -   NEXT_PUBLIC_DONATION_RECEIVER：捐赠接收地址（ETH），用于前端捐赠表单默认收款方
    -   NEXT_PUBLIC_ETHERSCAN_BASE：区块浏览器前缀（如 https://sepolia.etherscan.io），用于交易链接展示（可选）
    -   NEXT_PUBLIC_DONATION_CONTRACT：`DonationCampaigns` 合约地址（启用链上捐赠）

徽章合约部署与接入

1. 部署 BadgeNFT（contracts 工程）

```bash
cd contracts
pnpm install
pnpm hardhat run scripts/deploy-badge.ts --network localhost
# 或 --network sepolia
```

2. 后端环境变量

-   BADGE_NFT_ADDRESS：部署出的 BadgeNFT 合约地址（0x...）
-   BADGE_NFT_MINT_FN：可选，铸造方法名，默认 `safeMint(address,string)`
-   BADGE_NFT_URI_PREFIX：可选，默认 `badge:`（最终 tokenURI 为 `badge:<badgeName>`）
-   RPC_URL：节点 RPC（需与合约网络一致）
-   PRIVATE_KEY：拥有者私钥（BadgeNFT onlyOwner）

3. 验证

-   募捐合约（ETH/ERC20）

```bash
cd contracts
pnpm hardhat run scripts/deploy-donation.ts --network localhost
# 输出 DonationCampaigns 地址后，可在后端接入（可选，当前逻辑为离线汇总）
```

-   通过前端完成捐赠至触发阈值（默认 bronze/silver/gold），后端会自动铸造并将交易哈希写入 reward_badges 表。

3. 启动

```bash
docker compose up --build
```

启动后：

-   前端： http://localhost:3000
-   后端： http://localhost:8080

事件监听

-   后端启动时将尝试订阅 `DonationCampaigns` 的 `DonationReceived` 事件，并把链上捐赠同步进数据库。
-   需设置 `DONATION_CONTRACT_ADDRESS` 与 `RPC_URL`；未设置则跳过监听。
-   可选 `DONATION_START_BLOCK` 指定起始区块，配合游标表做断点续追。

角色与权限

-   角色：`user`（普通用户）、`org`（公益机构）、`admin`（管理员）
-   机构申请：登录后 `POST /api/org/apply` 提交资料，管理员在管理端“机构审核”通过后获得 `org` 身份
-   管理员：通过环境变量 `ADMIN_ADDRESSES` 指定地址列表（逗号分隔）
-   项目更新：`org` 或 `admin` 可通过 `POST /api/campaigns/{id}/updates` 发布

用户（user）

-   参与捐赠（ETH/ERC20）；达到阈值可获得积分与徽章
-   查看“我的捐赠”、排行榜与个人徽章

公益机构（org）

-   通过审核后可发布项目更新（如需开通 org 创建项目，可在后续启用）

管理员（admin）

-   项目创建/提现、机构审核、奖励配置、SMTP 测试
-   数据分析面板：KPI、近 30 天趋势、Top 项目、Gas 概览

项目规则与自动完结

-   最小捐赠 `minDonation`：低于该金额的捐赠将被拒绝
-   时间窗口：`startAt` 之前拒绝捐赠；`endAt` 之后项目视为到期
-   金额上限 `capAmount`：累计达到或超过即标记完成
-   自动完结：捐赠/提现后触发检查，满足“到期/达额”任一条件将 `status=completed`
-   前端：未开始/已结束时禁止发起捐赠并提示状态

接口一览（节选）

-   认证与用户
    -   `POST /api/auth/nonce`、`POST /api/auth/verify`：钱包登录
    -   `POST /api/auth/email/send`、`POST /api/auth/email/verify`、`POST /api/auth/register`
    -   `POST /api/org/apply`（用户）· `GET /api/org/list`、`POST /api/org/approve`（管理员）
-   项目与捐赠
    -   `GET /api/campaigns`、`POST /api/campaigns`（管理员创建，支持 beneficiary）
        -   创建请求体支持：`minDonation`、`startAt`、`endAt`、`capAmount`
    -   `GET /api/campaigns/{id}`：含最近 `donations` 与 `updates`
    -   `POST /api/campaigns/{id}/donations`：离线记录（链上事件也会回填）
    -   `POST /api/campaigns/{id}/withdraw`：管理员记账提现
    -   `POST /api/campaigns/{id}/updates`：机构/管理员发布项目动态
    -   `GET /api/donations?address=&campaignId=&from=&to=&page=&pageSize=`：捐赠查询
-   奖励与邮件
    -   `GET/POST /api/rewards/config`：积分与徽章阈值
    -   `GET /api/rewards/leaderboard`、`GET /api/rewards/badges/{address}`
    -   `GET /api/email/status`、`POST /api/email/test`（管理员）
-   数据分析（Analytics）
    -   `GET /api/analytics/summary`：总金额、总笔数、项目数、活跃项目数
    -   `GET /api/analytics/daily?days=30`：近 N 天金额与笔数
    -   `GET /api/analytics/top?type=campaign|donor&limit=10`：排行
    -   `GET /api/analytics/gas?limit=30`：平均 GasUsed / GasPrice / 手续费（依赖 `RPC_URL`）

前端页面导航

-   `首页 /`、`仪表板 /dashboard`、`管理员 /admin`（含“数据分析”面板）
-   `募捐项目 /campaigns`、`项目详情 /campaigns/[id]`（捐赠、项目更新）
-   `我的捐赠 /my-donations`（筛选/分页/导出 CSV）
-   `奖励 /rewards`（排行榜、我的徽章）

架构与数据流（简要）

```
[Frontend Next.js]
  ├─ Auth (wallet + email) → [Backend Go/JWT]
  ├─ Donate (ETH/ERC20 via DonationCampaigns) → [Chain]
  ├─ Lists/Details/Updates → [Backend REST]
  └─ Admin (Deploy/Org approval/Configs)

[Backend]
  ├─ REST APIs (auth, campaigns, donations, rewards, email)
  ├─ Watcher (Chain events → DB)  ← RPC_URL + DONATION_CONTRACT_ADDRESS
  └─ Postgres (contracts, campaigns, donations, updates, rewards, users)

[Chain]
  ├─ DonationCampaigns (events: DonationReceived, Withdrawn)
  └─ BadgeNFT (safeMint for badges)
```

部署与运维提示

-   建议为后端容器配置只读环境变量与只写少量持久卷（PostgreSQL 数据）
-   生产环境将 PRIVATE_KEY 与 AUTH_SECRET 放入安全的密钥管理服务
-   邮件与区块浏览器基地址按所用网络配置（如 `https://sepolia.etherscan.io`）
-   日志与指标可通过反向代理或 sidecar 收集（如 Loki/Prometheus）

基础流程

1. 注册

-   前端发送邮箱验证码 -> 后端保存验证码（未写入用户表）
-   验证邮箱成功 -> 前端提示继续“验证钱包”
-   钱包签名获取 token（isRegistration=true）
-   绑定邮箱与地址 -> 用户写入 users 表（verified=true，address）

2. 登录

-   钱包签名换取 token（后端校验地址是否已绑定邮箱）
-   管理员地址将自动颁发 admin 角色

3. 合约

-   选择模板或上传 artifact.json（含 abi/bytecode）
-   管理员发起部署（后端签名并写入数据库）
-   仪表盘列出合约，详情页提供方法读写交互

4. 常见命令

-   重建：docker compose up --build
-   查看后端日志：docker compose logs -f backend
-   查看数据库：docker compose exec db psql -U postgres -d app

安全提示

-   PRIVATE_KEY 仅用于测试/开发；生产请使用更安全的签名与权限方案（如外部签名服务/多签）
-   AUTH_SECRET 请使用高强度随机值
