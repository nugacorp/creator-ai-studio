# Creator AI Studio — crear proyecto Supabase, enlazar y aplicar migraciones
# Ejecutar en PowerShell (ruta con espacios OK):
#   cd "C:\Users\Ramiro Nuñez\creator-ai-studio"
#   $env:SUPABASE_DB_PASSWORD = "tu-password-seguro-32+"
#   .\scripts\supabase-create-and-push.ps1

param(
  [string]$OrgId = "mesanqmzbpcvbtifipfx",
  [string]$Region = "us-east-1",
  [string]$ProjectName = "creator-ai-studio",
  [string]$ProjectRef = "iiokqyedkylwhonbrrvo",
  [string]$DbPassword = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $RepoRoot

$env:SUPABASE_INTERNAL_NO_POSTHOG = "true"

function Invoke-SupabaseLatest {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & npx --yes supabase@latest @Args
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Org: Creator AI Studio ($OrgId)" -ForegroundColor Cyan

if (-not $ProjectRef) {
  $list = supabase projects list 2>$null | Out-String
  if ($list -match $ProjectName) {
    Write-Host "Proyecto '$ProjectName' ya existe. Copia REFERENCE ID de:" -ForegroundColor Yellow
    supabase projects list
    Write-Host "Luego: .\scripts\supabase-create-and-push.ps1 -ProjectRef TU_REF"
    exit 0
  }

  if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Host "Define contraseña de DB (32+ chars, guárdala en tu gestor de secretos):" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_DB_PASSWORD = "..."'
    exit 1
  }

  Write-Host "Creando proyecto '$ProjectName' (CLI 2.108+)..." -ForegroundColor Cyan
  Invoke-SupabaseLatest @(
    "projects", "create", $ProjectName,
    "--org-id", $OrgId,
    "--region", $Region,
    "--db-password", $env:SUPABASE_DB_PASSWORD,
    "-o", "json"
  )

  Start-Sleep -Seconds 5
  supabase projects list
  Write-Host ""
  Write-Host "Copia el REFERENCE ID y vuelve a ejecutar con -ProjectRef, o pégalo cuando te lo pida." -ForegroundColor Yellow

  $ProjectRef = Read-Host "REFERENCE ID del proyecto"
  if (-not $ProjectRef) { exit 1 }
}

Write-Host "Enlazando $ProjectRef..." -ForegroundColor Cyan
supabase link --project-ref $ProjectRef

if (-not $DbPassword -and $env:SUPABASE_DB_PASSWORD) {
  $DbPassword = $env:SUPABASE_DB_PASSWORD
}

if (-not $DbPassword) {
  Write-Host "Necesitamos la contraseña de Postgres del proyecto (Dashboard → Settings → Database)." -ForegroundColor Yellow
  $secure = Read-Host "Database password" -AsSecureString
  $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

Write-Host "Aplicando migraciones (pooler)..." -ForegroundColor Cyan
$poolerUrl = "postgresql://postgres.${ProjectRef}:$DbPassword@aws-1-us-west-2.pooler.supabase.com:5432/postgres"
supabase db push --db-url $poolerUrl --yes

Write-Host ""
Write-Host "Listo. Siguiente paso: variables en Coolify (ver docs/02-operations/SUPABASE_AUTH.md)" -ForegroundColor Green
Write-Host "  Dashboard → Project Settings → API → URL, anon key, JWT secret, service role"
