param(
  [Parameter(Mandatory = $true)]
  [string]$TempRoot,

  [Parameter(Mandatory = $true)]
  [string]$RunnerTempRoot,

  [Parameter(Mandatory = $true)]
  [string]$DebugRoot
)

$ErrorActionPreference = 'Stop'
$roots = @($TempRoot, $RunnerTempRoot, $DebugRoot) | Select-Object -Unique
$registrations = @()
$watchers = @()

try {
  foreach ($root in $roots) {
    if (-not $root) {
      continue
    }
    if (-not (Test-Path -LiteralPath $root)) {
      New-Item -ItemType Directory -Path $root -Force | Out-Null
    }

    Write-Output "Watching WebView2 discovery files under: $root"
    $watcher = [System.IO.FileSystemWatcher]::new($root, 'DevToolsActivePort')
    $watcher.IncludeSubdirectories = $true
    $watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite
    $watcher.EnableRaisingEvents = $true
    $watchers += $watcher

    foreach ($eventName in @('Created', 'Changed', 'Renamed')) {
      $registration = Register-ObjectEvent -InputObject $watcher -EventName $eventName -Action {
        $source = $Event.SourceEventArgs.FullPath
        $sourceDirectory = Split-Path -Parent $source
        if ((Split-Path -Leaf $sourceDirectory) -ne 'EBWebView') {
          return
        }

        $destination = Join-Path (Split-Path -Parent $sourceDirectory) 'DevToolsActivePort'
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
          try {
            Copy-Item -LiteralPath $source -Destination $destination -Force
            Write-Output "Mirrored WebView2 discovery file: $source -> $destination"
            return
          } catch {
            Start-Sleep -Milliseconds 25
          }
        }

        Write-Error "Could not mirror WebView2 discovery file after 20 attempts: $source"
      }
      $registrations += $registration
    }

    Get-ChildItem -LiteralPath $root -Filter 'DevToolsActivePort' -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { (Split-Path -Leaf $_.DirectoryName) -eq 'EBWebView' } |
      ForEach-Object {
        $destination = Join-Path (Split-Path -Parent $_.DirectoryName) 'DevToolsActivePort'
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
        Write-Output "Mirrored existing WebView2 discovery file: $($_.FullName) -> $destination"
      }
  }

  if ($registrations.Count -eq 0) {
    throw 'No existing roots were available for the WebView2 discovery watcher.'
  }

  while ($true) {
    foreach ($registration in $registrations) {
      Receive-Job -Job $registration -ErrorAction Continue
    }
    Start-Sleep -Seconds 1
  }
} finally {
  foreach ($registration in $registrations) {
    Unregister-Event -SubscriptionId $registration.Id -ErrorAction SilentlyContinue
    Remove-Job -Job $registration -Force -ErrorAction SilentlyContinue
  }
  foreach ($watcher in $watchers) {
    $watcher.Dispose()
  }
}
