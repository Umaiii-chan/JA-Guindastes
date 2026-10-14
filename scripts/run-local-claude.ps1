<#
.SYNOPSIS
  Roda o projeto NO HOST usando o Claude Code CLI logado como provedor de IA (TASK-083).

.DESCRIPTION
  SÓ PARA USO PESSOAL LOCAL. Usa o plano de assinatura de quem está logado no `claude` desta máquina.
  Nunca use em deploy nem exponha a porta na rede (ver docs/ia-claude-local.md).

  Passos: para os containers backend e frontend do compose (se estiverem de pé), sobe o Postgres,
  aplica migrations, seed e admin, inicia o backend (uvicorn em 127.0.0.1:8000, com AI_PROVIDER=claude_cli
  e CLAUDE_CLI_ENABLED=true) e o frontend (Vite, com proxy /api para 127.0.0.1:8000).
  O .env da raiz é lido sem imprimir valores. Ctrl+C encerra o frontend e o backend.

  Windows PowerShell 5.1. Rode da raiz do repositório:
    powershell -ExecutionPolicy Bypass -File scripts\run-local-claude.ps1

.PARAMETER Model
  Modelo do Claude CLI (CLAUDE_CLI_MODEL). Padrão: sonnet.
.PARAMETER EnvFile
  Caminho do .env. Padrão: .env da raiz (no worktree, cai no .env do repositório principal).
.PARAMETER SkipDb
  Pula migrations, seed e criação do admin.
#>
param(
  [string]$Model = 'sonnet',
  [string]$EnvFile = '',
  [switch]$SkipDb
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail($message) { Write-Host "ERRO: $message" -ForegroundColor Red; exit 1 }

# --- .env (sem imprimir valores) --------------------------------------------------------------
if (-not $EnvFile) {
  $EnvFile = Join-Path $root '.env'
  if (-not (Test-Path $EnvFile)) {
    # Em worktrees (.claude\worktrees\<nome>), o .env fica na raiz do repositório principal.
    $main = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $root))
    if (Test-Path (Join-Path $main '.env')) { $EnvFile = Join-Path $main '.env' }
  }
}
if (-not (Test-Path $EnvFile)) { Fail "arquivo .env não encontrado ($EnvFile). Copie .env.example para .env." }
foreach ($line in Get-Content -LiteralPath $EnvFile -Encoding UTF8) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $value = $Matches[2]
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path ("Env:" + $Matches[1]) -Value $value
  }
}
Write-Host "Lido: $EnvFile (valores não exibidos)"

# --- pré-requisitos ---------------------------------------------------------------------------
foreach ($tool in 'docker', 'uv', 'npm') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "'$tool' não está no PATH." }
}
$claudePath = if ($env:CLAUDE_CLI_PATH) { $env:CLAUDE_CLI_PATH } else { 'claude' }
if (-not (Get-Command $claudePath -ErrorAction SilentlyContinue)) {
  Fail "Claude Code CLI não encontrado ('$claudePath'). Instale-o, entre na conta (rode 'claude') ou ajuste CLAUDE_CLI_PATH."
}

# --- variáveis do modo local ------------------------------------------------------------------
$pgPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { '5432' }
if (-not $env:DATABASE_URL) {
  if (-not ($env:POSTGRES_USER -and $env:POSTGRES_PASSWORD -and $env:POSTGRES_DB)) {
    Fail 'defina DATABASE_URL (ou POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_DB) no .env.'
  }
  $env:DATABASE_URL = "postgresql+psycopg://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@127.0.0.1:$pgPort/$($env:POSTGRES_DB)"
}
if (-not $env:FILE_STORAGE_DIR) { $env:FILE_STORAGE_DIR = Join-Path $root '.local-data\load-charts' }
New-Item -ItemType Directory -Force -Path $env:FILE_STORAGE_DIR | Out-Null
$env:SESSION_COOKIE_SECURE = 'false'   # HTTP local
$env:AI_PROVIDER = 'claude_cli'
$env:CLAUDE_CLI_ENABLED = 'true'
$env:CLAUDE_CLI_MODEL = $Model

# --- containers e banco -----------------------------------------------------------------------
docker compose stop backend frontend 2>$null | Out-Null   # liberam 8000 e 8080, se estavam de pé
docker compose up -d --wait postgres
if ($LASTEXITCODE -ne 0) { Fail 'o Postgres não subiu (o Docker Desktop está aberto?).' }

Push-Location (Join-Path $root 'backend')
try {
  uv sync
  if ($LASTEXITCODE -ne 0) { Fail 'uv sync falhou.' }
  if (-not $SkipDb) {
    uv run alembic upgrade head
    if ($LASTEXITCODE -ne 0) { Fail 'as migrations falharam.' }
    uv run python -m app.demo_seed
    if ($LASTEXITCODE -ne 0) { Fail 'o seed da demo falhou.' }
    if ($env:ADMIN_PASSWORD) {
      uv run python -m app.create_admin --username admin
      if ($LASTEXITCODE -ne 0) { Fail 'a criação do admin falhou.' }
    } else {
      Write-Host 'ADMIN_PASSWORD ausente no .env: admin não criado (crie com python -m app.create_admin).' -ForegroundColor Yellow
    }
  }
} finally { Pop-Location }

# --- backend e frontend -----------------------------------------------------------------------
$logDir = Join-Path $env:TEMP 'ja-guindastes-local'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$backendOut = Join-Path $logDir 'backend.out.log'
$backendErr = Join-Path $logDir 'backend.err.log'
$backend = Start-Process -FilePath 'uv' -WorkingDirectory (Join-Path $root 'backend') `
  -ArgumentList 'run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000' `
  -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -WindowStyle Hidden -PassThru
Write-Host "Backend em http://127.0.0.1:8000 (logs em $logDir)"

try {
  $ready = $false
  for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    Start-Sleep -Seconds 1
    try { $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 2; $ready = $true } catch { }
  }
  if (-not $ready) { Fail "o backend não respondeu; veja $backendErr" }
  Write-Host 'IA: claude_cli (uso pessoal local). Frontend em http://localhost:5173 - Ctrl+C encerra.' -ForegroundColor Green

  Push-Location (Join-Path $root 'frontend')
  try {
    if (-not (Test-Path 'node_modules')) { npm ci }
    npm run dev -- --host 127.0.0.1
  } finally { Pop-Location }
} finally {
  if ($backend -and -not $backend.HasExited) {
    # uv inicia o uvicorn como filho: encerra a árvore inteira.
    taskkill /PID $backend.Id /T /F | Out-Null
  }
}
