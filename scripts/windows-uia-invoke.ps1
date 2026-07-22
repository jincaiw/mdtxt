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
while ([DateTime]::UtcNow -lt $deadline) {
  $process = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      $elements = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      foreach ($element in $elements) {
        try {
          $name = $element.Current.Name
          if ($name -notmatch $Pattern) { continue }
          $invoke = $null
          if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
            $invoke.Invoke()
            Write-Output "MDTXT_UIA_INVOKE pattern=$Pattern name=$name"
            exit 0
          }
          $legacy = $null
          if ($element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacy)) {
            $legacy.DoDefaultAction()
            Write-Output "MDTXT_UIA_INVOKE pattern=$Pattern name=$name method=legacy"
            exit 0
          }
        } catch {
          # React may replace an accessibility node while the tree is read.
        }
      }
    } catch {
      # Retry while the WebView accessibility root is starting.
    }
  }
  Start-Sleep -Milliseconds 200
}

throw "Timed out waiting to invoke UI Automation pattern '$Pattern'."
