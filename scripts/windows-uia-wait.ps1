param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [Parameter(Mandatory = $true)]
  [string]$Pattern,

  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$lastSnapshot = @()

while ([DateTime]::UtcNow -lt $deadline) {
  $process = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      $elements = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      $snapshot = @()
      foreach ($element in $elements) {
        try {
          $name = $element.Current.Name
          if (-not [string]::IsNullOrWhiteSpace($name)) {
            $snapshot += $name
            if ($name -match $Pattern) {
              Write-Output "MDTXT_UIA_MATCH pattern=$Pattern name=$name"
              exit 0
            }
          }
        } catch {
          # A WebView accessibility node can disappear while React commits.
        }
      }
      if ($snapshot.Count -gt 0) {
        $lastSnapshot = $snapshot
      }
    } catch {
      # The top-level window may be replacing its WebView during startup.
    }
  }
  Start-Sleep -Milliseconds 200
}

$dump = ($lastSnapshot | Select-Object -First 200) -join ' | '
throw "Timed out waiting for UI Automation pattern '$Pattern'. Accessible names: $dump"
