# Creator AI Studio — Supabase CLI setup (PowerShell)
# Usage: .\scripts\supabase-setup.ps1 -ProjectRef YOUR_REF
#    or: .\scripts\supabase-setup.ps1 -CreateProject

param(
  [string]$ProjectRef = "",
  [switch]$CreateProject,
  [string]$OrgId = "mesanqmzbpcvbtifipfx",
  [string]$Region = "us-east-1",
  [string]$ProjectName = "creator-ai-studio"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:SUPABASE_INTERNAL_NO_POSTHOG = "true"

if ($CreateProject) {
  if (-not $env:SUPABASE_DB_PASSWORD) {
    Write-Host "Set SUPABASE_DB_PASSWORD before creating a project (32+ chars)." -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Creating Supabase project '$ProjectName'..."
  npx --yes supabase@latest projects create $ProjectName --org-id $OrgId --region $Region --db-password $env:SUPABASE_DB_PASSWORD
  Write-Host "Run: supabase projects list  (copy REFERENCE ID)"
  exit 0
}

if (-not $ProjectRef) {
  if (Test-Path "supabase\.temp\project-ref") {
    $ProjectRef = Get-Content "supabase\.temp\project-ref" -Raw
    $ProjectRef = $ProjectRef.Trim()
  }
}

if (-not $ProjectRef) {
  Write-Host "Pass -ProjectRef YOUR_REF or run -CreateProject first." -ForegroundColor Yellow
  exit 1
}

Write-Host "Linking project $ProjectRef..."
supabase link --project-ref $ProjectRef

Write-Host "Pushing migrations..."
supabase db push

Write-Host "Done. Configure Coolify env vars — see docs/02-operations/SUPABASE_AUTH.md"
