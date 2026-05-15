param(
    [switch]$UseComposeGanache = $false,
    [int]$Campaigns = 50,
    [int]$Donations = 200,
    [int]$Concurrency = 40,
    [string]$Users = "",
    [switch]$DirectDb = $false,
    [int]$BulkCampaigns = 0,
    [int]$BulkDonations = 0,
    [switch]$BulkWithdrawals = $false,
    [int]$HttpDonations = 0,
    [int]$HttpConcurrency = 20
)

# 日志目录/文件
$logDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("seed-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

Write-Host "[1/8] 启动数据库..."
docker compose up -d pg 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Host "[2/8] 启动链..."
if ($UseComposeGanache) {
    docker compose --profile ganache up -d ganache 2>&1 | Tee-Object -FilePath $logFile -Append
    $chainRpc = "http://ganache:8545"          # 后端容器内可解析
    $seederRpc = "http://host.docker.internal:8545"  # seeder 容器用宿主机地址，避免 DNS 抖动
} else {
    $chainRpc = "http://host.docker.internal:8545"
    $seederRpc = $chainRpc
}

# 等待链 RPC 可用
Write-Host "等待链 RPC 就绪: $seederRpc ..."
$ready = $false
for ($i=0; $i -lt 60; $i++) {
    try {
        $payload = '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
        $res = Invoke-RestMethod -Method Post -Uri $seederRpc -ContentType 'application/json' -Body $payload -TimeoutSec 2
        if ($res -and $res.result) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Write-Warning "链 RPC 未就绪，继续尝试后续步骤，可能导致 seeder 失败。" }

Write-Host "[3/8] 启动后端与前端..."
$env:CHAIN_RPC = $chainRpc
docker compose up -d backend frontend 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Host "[4/8] 运行造数脚本..."
Push-Location "$PSScriptRoot/../contracts"

$useDockerSeeder = $false
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm i 2>&1 | Tee-Object -FilePath $logFile -Append
    pnpm build 2>&1 | Tee-Object -FilePath $logFile -Append
    $env:BACKEND_BASE = "http://localhost:8080"
    $env:RPC_URL = "http://127.0.0.1:8545"
    $env:SEED_CAMPAIGNS = "$Campaigns"
    $env:SEED_DONATIONS = "$Donations"
    $env:SEED_CONCURRENCY = "$Concurrency"
    pnpm seed:ganache 2>&1 | Tee-Object -FilePath $logFile -Append
} else {
    # 无本地 pnpm，改用容器内 seeder
    Pop-Location
    $useDockerSeeder = $true
    docker compose run --rm --add-host=host.docker.internal:host-gateway -e BACKEND_BASE=http://backend:8080 -e RPC_URL=$seederRpc -e SEED_CAMPAIGNS=$Campaigns -e SEED_DONATIONS=$Donations -e SEED_CONCURRENCY=$Concurrency contracts-seeder 2>&1 | Tee-Object -FilePath $logFile -Append
}

# 可选：导入用户（支持 .json 或 .csv 文件）。支持两种模式：HTTP 或直连数据库
if ($DirectDb -or ($BulkDonations -gt 0)) {
    Write-Host "[5/8] 初始化数据库表结构..."
    $schemaSql = @"
-- users / email_codes / orgs
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS orgs (
  address TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,
  docs TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_address_uindex ON users(address) WHERE address IS NOT NULL;

-- campaigns / donations / campaign_updates
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal_amount TEXT NOT NULL,
  raised_amount TEXT NOT NULL DEFAULT '0',
  image TEXT,
  owner TEXT,
  status TEXT,
  beneficiary TEXT,
  withdrawn_amount TEXT NOT NULL DEFAULT '0',
  last_withdraw_at TIMESTAMPTZ,
  min_donation TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  cap_amount TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  donor TEXT NOT NULL,
  amount TEXT NOT NULL,
  tx_hash TEXT,
  token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS campaign_updates (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"@
    docker compose exec -T pg psql -U app -d blockchain -v ON_ERROR_STOP=1 -c "$schemaSql" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
}

if ($Users -and (Test-Path $Users)) {
    if ($DirectDb) {
        Write-Host "[6/8] 直连数据库导入用户..."
        try {
            $ext = [System.IO.Path]::GetExtension($Users).ToLower()
            if ($ext -eq ".json") { $usersData = Get-Content $Users -Raw | ConvertFrom-Json }
            elseif ($ext -eq ".csv") { $usersData = Import-Csv $Users }
            else { Write-Warning "不支持的用户文件类型: $ext，支持 .json 或 .csv"; $usersData = @() }
            foreach ($u in $usersData) {
                $email = $u.email; if (-not $email) { $email = $u.Email }
                $address = $u.address; if (-not $address) { $address = $u.Address }
                if (-not $email -or -not $address) { continue }
                $emailEsc = ($email -replace "'","''").ToLower()
                $addrEsc = ($address -replace "'","''").ToLower()
                $sql = "INSERT INTO users(email, verified, address) VALUES ('" + $emailEsc + "', TRUE, '" + $addrEsc + "') ON CONFLICT (email) DO UPDATE SET verified=TRUE, address=EXCLUDED.address;"
                docker compose exec -T pg psql -U app -d blockchain -c "$sql" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
            }
        } catch {
            $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null
        }
    } else {
        Write-Host "[6/8] HTTP 导入用户..."
        $backendBase = "http://localhost:8080"
        try {
            $ext = [System.IO.Path]::GetExtension($Users).ToLower()
            if ($ext -eq ".json") { $usersData = Get-Content $Users -Raw | ConvertFrom-Json }
            elseif ($ext -eq ".csv") { $usersData = Import-Csv $Users }
            else { Write-Warning "不支持的用户文件类型: $ext，支持 .json 或 .csv"; $usersData = @() }
            foreach ($u in $usersData) {
                $email = $u.email; if (-not $email) { $email = $u.Email }
                $address = $u.address; if (-not $address) { $address = $u.Address }
                if (-not $email -or -not $address) { continue }
                $payload = @{ Email = "$email"; Address = "$address" } | ConvertTo-Json
                try {
                    Invoke-RestMethod -Method Post -Uri "$backendBase/api/auth/register" -ContentType "application/json" -Body $payload 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
                } catch { $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null }
            }
        } catch { $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null }
    }
} else {
    Write-Host "未提供用户文件，跳过导入。"
}

# 可选：直连数据库批量生成捐赠记录，用于性能/统计测试
if ($BulkDonations -gt 0 -or $BulkCampaigns -gt 0 -or $BulkWithdrawals) {
    Write-Host "[7/8] 直连数据库批量生成数据..."
    try {
        if ($BulkCampaigns -gt 0) {
            $sqlCamp = "CREATE EXTENSION IF NOT EXISTS pgcrypto; INSERT INTO campaigns(id, title, description, goal_amount, created_at) SELECT 'cmp-'||encode(digest(gen_random_uuid()::text,'md5'),'hex'), 'Auto campaign '||gs, 'Seeded for perf test', (100 + floor(random()*900))::text, NOW() - (random()*INTERVAL '60 days') FROM generate_series(1, $BulkCampaigns) gs;"
            docker compose exec -T pg psql -U app -d blockchain -c "$sqlCamp" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
        }

        if ($BulkDonations -gt 0) {
            $sqlDon = "CREATE TEMP TABLE IF NOT EXISTS _u AS SELECT address FROM users WHERE address IS NOT NULL; CREATE TEMP TABLE IF NOT EXISTS _c AS SELECT id FROM campaigns; INSERT INTO donations(id, campaign_id, donor, amount, tx_hash, token, created_at) SELECT encode(digest(gen_random_uuid()::text,'md5'),'hex'), (SELECT id FROM _c ORDER BY random() LIMIT 1), (SELECT address FROM _u ORDER BY random() LIMIT 1), ((random()*0.5 + 0.01)::numeric(20,8))::text, '', 'ETH', NOW() - (random()*INTERVAL '30 days') FROM generate_series(1, $BulkDonations); UPDATE campaigns c SET raised_amount = x.total::text FROM ( SELECT campaign_id, COALESCE(SUM((amount)::numeric),0) AS total FROM donations GROUP BY campaign_id ) x WHERE c.id = x.campaign_id;"
            docker compose exec -T pg psql -U app -d blockchain -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
            docker compose exec -T pg psql -U app -d blockchain -c "$sqlDon" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
        }

        if ($BulkWithdrawals) {
            $sqlW = "UPDATE campaigns SET withdrawn_amount = LEAST((COALESCE(NULLIF(raised_amount,''),'0'))::numeric, ((COALESCE(NULLIF(raised_amount,''),'0'))::numeric * (random()*0.7))::numeric)::text, last_withdraw_at = NOW() - (random()*INTERVAL '10 days') WHERE random() < 0.5;"
            docker compose exec -T pg psql -U app -d blockchain -c "$sqlW" 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Null
        }
    } catch {
        $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null
    }
}

# 从日志提取合约地址
$contractAddress = $null
Get-Content $logFile | ForEach-Object {
    if ($_ -match 'DONATION_CONTRACT_ADDRESS=(0x[a-fA-F0-9]{40})') {
        $contractAddress = $matches[1]
    }
}

if (-not $useDockerSeeder) { Pop-Location }

if (-not $contractAddress) {
    Write-Warning "未从造数输出中获取合约地址，跳过后端重启。日志: $logFile"
    Write-Host "完成。"
    exit 0
}

if ($HttpDonations -gt 0) {
    Write-Host "[8/9] HTTP 并发模拟捐赠 ($HttpDonations, 并发=$HttpConcurrency)..."
    try {
        $backendBase = "http://localhost:8080"
        # 读取项目列表
        $camps = @()
        try { $camps = Invoke-RestMethod -Method Get -Uri "$backendBase/api/campaigns" } catch {}
        if (-not $camps -or $camps.Count -eq 0) { Write-Warning "无可用项目，跳过 HTTP 捐赠" }
        else {
            # 读取捐赠地址（从 DB）
            $addrRaw = docker compose exec -T pg psql -U app -d blockchain -At -c "SELECT address FROM users WHERE address IS NOT NULL" 2>&1
            $donors = @()
            if ($LASTEXITCODE -eq 0) { $donors = ($addrRaw -split "`n") | Where-Object { $_ -and ($_ -notmatch "psql:") } }
            if (-not $donors -or $donors.Count -eq 0) { Write-Warning "无可用捐赠地址，跳过 HTTP 捐赠" }
            else {
                $jobs = 1..$HttpDonations | ForEach-Object {
                    [PSCustomObject]@{ i=$_; camp=$camps[(Get-Random -Minimum 0 -Maximum $camps.Count)]; donor=$donors[(Get-Random -Minimum 0 -Maximum $donors.Count)] }
                }
                $throttle = [Math]::Max(1, [Math]::Min(256, $HttpConcurrency))
                $jobs | ForEach-Object -Parallel {
                    try {
                        $cid = $_.camp.id
                        $don = $_.donor.Trim().ToLower()
                        $amt = [Math]::Round((Get-Random) * 0.5 + 0.01, 6)
                        $body = @{ id = ([Guid]::NewGuid().ToString("N")); donor = $don; amount = "$amt"; txHash = ""; token = "ETH" } | ConvertTo-Json
                        Invoke-RestMethod -Method Post -Uri ("$($using:backendBase)/api/campaigns/" + $cid + "/donations") -ContentType "application/json" -Body $body | Out-Null
                    } catch { }
                } -ThrottleLimit $throttle
            }
        }
    } catch { $_ | Out-String | Tee-Object -FilePath $logFile -Append | Out-Null }
}

Write-Host "[9/9] 注入 DONATION_CONTRACT_ADDRESS 并重启后端..."
$env:DONATION_CONTRACT_ADDRESS = $contractAddress
docker compose stop backend 2>&1 | Tee-Object -FilePath $logFile -Append
docker compose up -d backend 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Host "完成。合约地址: $contractAddress"

