# Apply rclone OAuth token to staging VPS (one-shot).
# Usage:
#   1. rclone authorize drive  -> save the JSON line to local-dev/rclone-oauth.json
#   2. .\scripts\local-apply-rclone-to-vps.ps1
param(
  [string]$TokenFile = "$PSScriptRoot\..\local-dev\rclone-oauth.json",
  [string]$SshKey = "$env:USERPROFILE\.ssh\cursor_creator_studio",
  [string]$RemoteHost = "root@217.76.56.66"
)

$ErrorActionPreference = "Stop"
$knownHosts = "C:\Temp\known_hosts_cas"
$sshOpts = @("-i", $SshKey, "-o", "UserKnownHostsFile=$knownHosts", "-o", "StrictHostKeyChecking=accept-new")

if (-not (Test-Path $TokenFile)) {
  Write-Host "Missing $TokenFile"
  Write-Host "Run: rclone authorize drive"
  Write-Host "Save the full JSON line (from { to }) into that file."
  exit 1
}

$raw = (Get-Content $TokenFile -Raw).Trim()
if (-not $raw.StartsWith("{")) {
  Write-Host "Token file must be a single JSON object starting with {"
  exit 1
}

Write-Host "Uploading token and applying on VPS..."
scp @sshOpts $TokenFile "${RemoteHost}:/tmp/rclone-oauth.json"
ssh @sshOpts $RemoteHost "RCLONE_OAUTH_TOKEN_FILE=/tmp/rclone-oauth.json bash /root/creator-ai-studio/scripts/vps-apply-rclone-token.sh"
Write-Host "Redeploying..."
ssh @sshOpts $RemoteHost "cd /root/creator-ai-studio && set -a && source <(sed 's/\r$//' .env.supabase.local) && set +a && bash scripts/vps-redeploy.sh rclone-local"
Write-Host "Verify:"
ssh @sshOpts $RemoteHost 'API=$(docker ps -q --filter name=api-z7b1ieqp66a7e43cywaz816w | sed -n "1p"); docker exec $API rclone lsd gdrive:Creator-AI-Studio/episodes'
