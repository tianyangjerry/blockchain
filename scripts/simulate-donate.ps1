param(
    [string]$Receiver = "",
    [string]$Amount = "0.05",
    [int]$Txs = 20,
    [int]$Concurrency = 10,
    [string]$BackendBase = "http://localhost:8080",
    [string]$CampaignId = "",
    [switch]$RecordToBackend,
    [string]$Rpc = ""
)

# Resolve receiver: prefer arg; else from compose env; else ganache[0]
function Get-GanacheAccounts {
    try {
        $payload = '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}'
        $resp = Invoke-RestMethod -Method Post -Uri $script:ResolvedRpc -ContentType 'application/json' -Body $payload -TimeoutSec 3
        return $resp.result
    } catch { return @() }
}

# Resolve RPC endpoint (try provided, then common defaults)
$candidates = @()
if ($Rpc) { $candidates += $Rpc }
$candidates += @("http://127.0.0.1:8545","http://localhost:8545")
$script:ResolvedRpc = $null
foreach ($cand in $candidates | Select-Object -Unique) {
    try {
        $probe = '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
        $r = Invoke-RestMethod -Method Post -Uri $cand -ContentType 'application/json' -Body $probe -TimeoutSec 2
        if ($r -and $r.result) { $script:ResolvedRpc = $cand; break }
    } catch {}
}
if (-not $script:ResolvedRpc) { $script:ResolvedRpc = "http://127.0.0.1:8545" }

$rcv = $Receiver
if (-not $rcv) {
    # Try docker compose env (frontend)
    try {
        $envs = docker compose config | Out-String
        if ($envs -match 'NEXT_PUBLIC_DONATION_RECEIVER: (0x[a-fA-F0-9]{40})') { $rcv = $matches[1] }
    } catch {}
}
if (-not $rcv) {
    $accts = Get-GanacheAccounts
    if ($accts.Count -gt 0) { $rcv = $accts[0] }
}
if (-not $rcv) { Write-Error "无法确定收款地址，请使用 -Receiver 参数或在 compose 中配置 NEXT_PUBLIC_DONATION_RECEIVER"; exit 1 }

Write-Host "Receiver: $rcv"
Write-Host "RPC: $script:ResolvedRpc"

# Build tx payloads from ganache accounts
$accounts = Get-GanacheAccounts
if ($accounts.Count -eq 0) { for ($i=0;$i -lt 120;$i++) { Start-Sleep -Milliseconds 500; $accounts = Get-GanacheAccounts; if ($accounts.Count -gt 0) { break } } }
if ($accounts.Count -eq 0) { Write-Error "Ganache 未就绪或无法获取账户 ($script:ResolvedRpc)"; exit 1 }
if ($accounts.Count -gt 1) { $senders = $accounts | Select-Object -Skip 1 } else { $senders = $accounts }

# helper: build and send raw tx via eth_sendTransaction
function Send-OneTx([string]$from, [string]$to, [string]$amountEth) {
    $wei = [System.Numerics.BigInteger]([decimal]$amountEth * [decimal](1e18))
    $data = '{"jsonrpc":"2.0","id":1,"method":"eth_sendTransaction","params":[{"from":"' + $from + '","to":"' + $to + '","value":"0x' + ($wei.ToString("x")) + '"}]}'
    try { (Invoke-RestMethod -Method Post -Uri $script:ResolvedRpc -ContentType 'application/json' -Body $data -TimeoutSec 5).result } catch { $null }
}

$throttle = [Math]::Max(1,[Math]::Min(256,$Concurrency))
$running = 0
$queue = New-Object System.Collections.Queue
for ($i=0; $i -lt $Txs; $i++) { $queue.Enqueue($i) }

$submitted = 0
while ($queue.Count -gt 0 -or $running -gt 0) {
    while ($queue.Count -gt 0 -and $running -lt $throttle) {
        $idx = $queue.Dequeue()
        $from = $senders[$idx % $senders.Count]
        Start-Job -ScriptBlock {
            param($from,$to,$Amount,$BackendBase,$CampaignId,$RecordToBackend)
            $txh = $null
            try {
                $txh = Send-OneTx -from $from -to $to -amountEth $Amount
                if ($RecordToBackend -and $CampaignId -and $txh) {
                    try {
                        $body = @{ id = ("sim-" + [guid]::NewGuid().ToString("N")); donor=$from; amount=$Amount; txHash=$txh; token='ETH' } | ConvertTo-Json
                        Invoke-RestMethod -Method Post -Uri ($BackendBase + "/api/campaigns/" + $CampaignId + "/donations") -ContentType 'application/json' -Body $body | Out-Null
                    } catch {}
                }
            } catch {}
            return $txh
        } -ArgumentList @($from,$rcv,$Amount,$BackendBase,$CampaignId,$RecordToBackend) | Out-Null
        $running++
        $submitted++
    }
    $done = Get-Job | Where-Object { $_.State -ne 'Running' }
    foreach ($j in $done) { Receive-Job $j | Out-Null; Remove-Job $j | Out-Null; $running-- }
    Start-Sleep -Milliseconds 100
}

Write-Host "完成，已提交 $Txs 笔交易。"
