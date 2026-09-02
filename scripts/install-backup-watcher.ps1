[CmdletBinding()]
param(
    [string]$TaskName = 'VideoTagger MySQL Backup Watcher'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$watcherPath = Join-Path $PSScriptRoot 'backup-mysql-watch.ps1'
$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
$backupRoot = Join-Path $localAppData 'VideoTagger\backup'

if (-not (Test-Path -LiteralPath $watcherPath -PathType Leaf)) {
    throw "Backup watcher not found: $watcherPath"
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $powerShell -Argument ('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $watcherPath) -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Monitors Docker MySQL and creates hourly Video Tagger database backups.' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Output ("Installed and started scheduled task: {0}" -f $TaskName)
Write-Output ("Backup directory: {0}" -f $backupRoot)
Write-Output 'The watcher waits for vt-mysql to become healthy, then backs up immediately and once per hour.'
