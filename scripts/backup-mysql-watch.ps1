[CmdletBinding()]
param(
    [string]$ContainerName = 'vt-mysql',
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$DatabaseName = 'video_tagger',
    [ValidateRange(1, 86400)]
    [int]$ScanIntervalSeconds = 30,
    [ValidateRange(1, 10080)]
    [int]$BackupIntervalMinutes = 60,
    [ValidateRange(1, 100)]
    [int]$KeepGenerations = 3,
    [switch]$OneShot,
    [string]$CDriveBackupRoot = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'VideoTagger\backup')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectBackupRoot = Join-Path $projectRoot 'data\backup'
$logPath = Join-Path $CDriveBackupRoot 'backup-watcher.log'
$mutexName = 'Global\VideoTagger-MySqlBackupWatcher'
$mutex = $null
$ownsMutex = $false
$dockerCommand = $null

function Write-BackupLog {
    param(
        [ValidateSet('INFO', 'WARN', 'ERROR')]
        [string]$Level,
        [string]$Message
    )

    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    try {
        Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    } catch {
        Write-Warning $line
    }
}

function Initialize-BackupDirectories {
    New-Item -ItemType Directory -Path $projectBackupRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $CDriveBackupRoot -Force | Out-Null
}

function Get-DockerCommand {
    try {
        return (Get-Command docker.exe -ErrorAction Stop).Source
    } catch {
        try {
            return (Get-Command docker -ErrorAction Stop).Source
        } catch {
            return $null
        }
    }
}

function Get-MySqlContainerState {
    if ($null -eq $dockerCommand) {
        return 'docker-cli-missing'
    }

    $null = & $dockerCommand info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -ne 0) {
        return 'docker-unavailable'
    }

    $inspect = @(& $dockerCommand inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' $ContainerName 2>$null)
    if ($LASTEXITCODE -ne 0 -or $inspect.Count -eq 0) {
        return 'container-missing'
    }

    $parts = ($inspect[0].ToString().Trim() -split '\|', 2)
    if ($parts.Count -lt 2) {
        return 'container-unknown'
    }

    if ($parts[0] -ne 'running') {
        return 'container-' + $parts[0]
    }

    return 'mysql-' + $parts[1]
}

function Remove-OldBackupGenerations {
    param([string]$FileNameToKeep)

    $projectFiles = @(Get-ChildItem -LiteralPath $projectBackupRoot -Filter 'video_tagger_*.sql' -File -ErrorAction SilentlyContinue)
    $pairedFiles = @(
        $projectFiles |
            Where-Object { Test-Path -LiteralPath (Join-Path $CDriveBackupRoot $_.Name) } |
            Sort-Object Name -Descending
    )

    $oldFiles = @($pairedFiles | Select-Object -Skip $KeepGenerations)
    foreach ($file in $oldFiles) {
        if ($file.Name -eq $FileNameToKeep) {
            continue
        }

        $cDriveFile = Join-Path $CDriveBackupRoot $file.Name
        try {
            Remove-Item -LiteralPath $file.FullName -Force
            Remove-Item -LiteralPath $cDriveFile -Force
            Write-BackupLog INFO ("Removed old backup generation: {0}" -f $file.Name)
        } catch {
            Write-BackupLog WARN ("Could not remove old backup generation {0}: {1}" -f $file.Name, $_.Exception.Message)
        }
    }
}

function Invoke-MySqlBackup {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $fileName = 'video_tagger_{0}.sql' -f $stamp
    $tempSuffix = [Guid]::NewGuid().ToString('N')
    $tempProjectFile = Join-Path $projectBackupRoot ('.{0}.{1}.tmp' -f $fileName, $tempSuffix)
    $tempCDriveFile = Join-Path $CDriveBackupRoot ('.{0}.{1}.tmp' -f $fileName, $tempSuffix)
    $projectFile = Join-Path $projectBackupRoot $fileName
    $cDriveFile = Join-Path $CDriveBackupRoot $fileName
    $remoteFile = '/tmp/vt-mysql-backup-{0}.sql' -f $tempSuffix

    try {
        $dumpCommand = @"
set -e
export MYSQL_PWD="`$MYSQL_ROOT_PASSWORD"
mysqldump --user=root --single-transaction --routines --events --triggers --hex-blob --default-character-set=utf8mb4 --set-gtid-purged=OFF --no-tablespaces --databases $DatabaseName > $remoteFile
"@

        Write-BackupLog INFO ("Starting MySQL backup: {0}" -f $fileName)
        $null = & $dockerCommand exec $ContainerName sh -c $dumpCommand 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw 'mysqldump failed inside vt-mysql'
        }

        $null = & $dockerCommand cp ("{0}:{1}" -f $ContainerName, $remoteFile) $tempProjectFile 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw 'docker cp failed while collecting the dump'
        }

        $projectLength = (Get-Item -LiteralPath $tempProjectFile).Length
        if ($projectLength -le 0) {
            throw 'mysqldump produced an empty file'
        }

        Copy-Item -LiteralPath $tempProjectFile -Destination $tempCDriveFile -Force
        $cDriveLength = (Get-Item -LiteralPath $tempCDriveFile).Length
        if ($projectLength -ne $cDriveLength) {
            throw 'project and C-drive backup sizes differ'
        }

        Move-Item -LiteralPath $tempProjectFile -Destination $projectFile -Force
        Move-Item -LiteralPath $tempCDriveFile -Destination $cDriveFile -Force
        Write-BackupLog INFO ("MySQL backup completed: {0} ({1} bytes in each location)" -f $fileName, $projectLength)
        Remove-OldBackupGenerations -FileNameToKeep $fileName
        return $true
    } catch {
        Write-BackupLog ERROR ("MySQL backup failed: {0}" -f $_.Exception.Message)
        return $false
    } finally {
        Remove-Item -LiteralPath $tempProjectFile -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $tempCDriveFile -Force -ErrorAction SilentlyContinue
        if ($null -ne $dockerCommand) {
            $null = & $dockerCommand exec $ContainerName rm -f $remoteFile 2>$null
        }
    }
}

try {
    Initialize-BackupDirectories
    $dockerCommand = Get-DockerCommand
    if ($null -eq $dockerCommand) {
        Write-BackupLog WARN 'Docker CLI not found in PATH; watcher will wait for it.'
    }
    $mutex = [Threading.Mutex]::new($false, $mutexName)
    try {
        $ownsMutex = $mutex.WaitOne(0)
    } catch [Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }

    if (-not $ownsMutex) {
        Write-BackupLog WARN 'Another MySQL backup watcher is already running; exiting.'
        exit 0
    }

    if ($OneShot) {
        $oneShotState = Get-MySqlContainerState
        Write-BackupLog INFO ("One-shot backup requested; MySQL state: {0}" -f $oneShotState)
        if ($oneShotState -ne 'mysql-healthy') {
            throw ("MySQL is not healthy: {0}" -f $oneShotState)
        }
        if (-not (Invoke-MySqlBackup)) {
            exit 1
        }
        exit 0
    }

    Write-BackupLog INFO ("Watcher started. Scan interval: {0}s; backup interval: {1}m" -f $ScanIntervalSeconds, $BackupIntervalMinutes)
    $lastState = $null
    $nextBackupAt = $null

    while ($true) {
        if ($null -eq $dockerCommand) {
            $dockerCommand = Get-DockerCommand
        }
        $state = Get-MySqlContainerState
        if ($state -ne $lastState) {
            Write-BackupLog INFO ("MySQL state changed: {0}" -f $state)
            if ($state -eq 'mysql-healthy') {
                $nextBackupAt = Get-Date
            } else {
                $nextBackupAt = $null
            }
            $lastState = $state
        }

        if ($state -eq 'mysql-healthy' -and ($null -eq $nextBackupAt -or (Get-Date) -ge $nextBackupAt)) {
            if (Invoke-MySqlBackup) {
                $nextBackupAt = (Get-Date).AddMinutes($BackupIntervalMinutes)
            } else {
                $nextBackupAt = (Get-Date).AddMinutes(5)
                Write-BackupLog WARN 'Next backup retry scheduled in 5 minutes.'
            }
        }

        Start-Sleep -Seconds $ScanIntervalSeconds
    }
} catch {
    try {
        Write-BackupLog ERROR ("Watcher stopped unexpectedly: {0}" -f $_.Exception.Message)
    } catch {
        Write-Error $_
    }
    exit 1
} finally {
    if ($ownsMutex -and $null -ne $mutex) {
        $mutex.ReleaseMutex()
    }
    if ($null -ne $mutex) {
        $mutex.Dispose()
    }
}
