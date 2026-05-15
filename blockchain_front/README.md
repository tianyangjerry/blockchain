前端说明（Next.js / TanStack Query）

概览
前端提供完整的注册登录、管理员发布、仪表盘与合约详情交互界面。采用黑金极简风设计，数据获取统一使用 TanStack Query。

主要页面

-   app/page.tsx：首页（品牌与引导）
-   app/login/page.tsx：登录页（邮箱/密码输入 + 钱包登录按钮）
-   app/register/page.tsx：注册页（邮箱验证码 -> 验证钱包 -> 绑定）
-   app/dashboard/page.tsx：用户仪表盘（合约列表）
-   app/admin/page.tsx：管理员发布合约（模板/上传 artifact，发布状态）
-   app/contracts/[address]/page.tsx：合约详情（方法只读/写交互、ABI 展示）

核心组件与职责

-   app/components/Header.tsx：导航头部
-   app/components/Guard.tsx：简易路由守卫（鉴权/角色判断）
-   app/components/ContractList.tsx：合约列表展示与选择
-   app/components/ContractDeployForm.tsx：发布表单（模板选择、artifact 上传、构造参数）
-   app/components/TxStatus.tsx：交易状态与哈希展示
-   app/components/ConnectWallet.tsx：连接钱包 UI（如需独立使用）
-   app/components/AuthForm.tsx：登录/注册表单（邮箱验证码、钱包验证与绑定）

状态与数据

-   app/context/AuthContext.tsx：JWT 与用户信息（地址/角色），提供 loginWithWallet、logout；从 localStorage 初始化
-   app/lib/api.ts：前端 API 封装（listContracts、getContract、listTemplates、getTemplate、registerBind 等）
-   app/lib/auth.ts：获取 JWT（签名 verify）与请求封装 withAuth
-   app/lib/web3.ts：web3 初始化、ensureAccounts 等
-   app/providers.tsx + app/query.ts：TanStack Query 与 Auth Provider 注入

样式

-   app/globals.css：Tailwind（inline theme）+ 动画（fade-in/slide-up/glow）
-   所有主要页面与组件采用黑金风：深色基底、玻璃卡片、金色交互
