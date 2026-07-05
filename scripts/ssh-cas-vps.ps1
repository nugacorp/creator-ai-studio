# SSH to CAS VPS (cas-core-01) as root using cursor_creator_studio key.
param(
  [string]$Command = ""
)

$Key = Join-Path $env:USERPROFILE ".ssh\cursor_creator_studio"
$KnownHosts = "C:\Temp\known_hosts_cas"
$SshTarget = "root@217.76.56.66"

if (-not (Test-Path $Key)) {
  Write-Error "Missing key: $Key"
  exit 1
}

if (-not (Test-Path $KnownHosts)) {
  New-Item -ItemType File -Path $KnownHosts -Force | Out-Null
}

$sshArgs = @(
  "-i", $Key,
  "-o", "UserKnownHostsFile=$KnownHosts",
  "-o", "BatchMode=yes",
  $SshTarget
)

if ($Command) {
  $sshArgs += $Command
}

& ssh @sshArgs
exit $LASTEXITCODE
