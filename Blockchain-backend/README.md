后端说明（Go / PostgreSQL）

概览
后端提供认证、模板、合约、交易跟踪等 HTTP API，存储使用 PostgreSQL。部署交易通过配置的 RPC_URL 与 PRIVATE_KEY 由后端代签名完成。

模块结构

-   main.go：入口，仅做依赖初始化与路由注册
-   server.go：Server 结构与 RegisterRoutes
-   handlers_auth.go：认证相关路由
    -   /api/auth/nonce：申请 nonce（地址 -> 一次性随机数）
    -   /api/auth/verify：使用钱包签名 + nonce 验证生成 JWT；isRegistration=true 时跳过地址绑定检查
    -   /api/auth/register：邮箱 + 地址绑定（写 users 表，verified=true, address）
    -   /api/auth/email/send：发送邮箱验证码（未绑定时可发）
    -   /api/auth/email/verify：校验验证码（只删除验证码，不写用户表）
-   handlers_contracts.go：合约相关路由
    -   GET /api/contracts：列出已保存的合约记录
    -   POST /api/contracts：创建合约记录（一般由部署成功后调用）
    -   POST /api/contracts/deploy：部署合约（需要管理员 JWT）；根据 ABI/Bytecode 与构造参数进行部署；含参数类型自动转化；部署成功写入数据库
    -   GET /api/contracts/{address}：获取指定地址的合约记录
-   templates_handlers.go：模板路由
    -   GET /api/contracts/templates：返回模板清单（SimpleRegistry、SampleERC20）
    -   GET /api/contracts/template/{name}：返回模板详情（ABI、Bytecode、示例构造参数）
-   handlers_misc.go：
    -   GET /healthz：健康检查
-   http_utils.go：JSON/CORS 辅助
-   auth_utils.go：Authorization 解析与 JWT 验签
-   crypto_utils.go：personal_sign 验证（EIP-191）
-   env_utils.go：读取环境变量
-   contracts/：合约存储接口与 PG 实现
    -   store.go / pgstore.go / types.go

与智能合约关系

-   部署：/api/contracts/deploy 由后端使用 PRIVATE_KEY 创建交易，连接 RPC_URL 发送。ABI 用于构建部署交易，Bytecode 为合约字节码，构造参数会根据 ABI 类型自动转换（string、uint/int -> \*big.Int、address -> common.Address）。
-   读取：前端直接通过 web3.js 与节点交互（只读/写方法），后端仅负责记录与模板，不代理读写调用。
-   记录：部署成功后，会把 Name/Address/ABI/Network/TxHash 写入 PostgreSQL，供前端查询列表与详情。

鉴权与角色

-   /api/auth/verify 生成 JWT；若地址在 ADMIN_ADDRESSES 中，则颁发 admin 角色。
-   需要管理员的接口：/api/contracts/deploy、POST /api/contracts（通常由部署流程内部使用）。

环境变量

-   PG*DSN、RPC_URL、PRIVATE_KEY、AUTH_SECRET、ADMIN_ADDRESSES、SMTP*\*（可选）
