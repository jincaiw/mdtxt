param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [Parameter(Mandatory = $true)]
  [int]$Index,

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
      $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem
      )
      $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
      if ($tabs.Count -gt $Index) {
        $tab = $tabs.Item($Index)
        $tab.SetFocus()
        Write-Output "MDTXT_UIA_FOCUS_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name)"
        exit 0
      }
    } catch {
      # React/WebView2 may replace the accessibility node while recovery mounts.
    }
  }
  Start-Sleep -Milliseconds 200
}

throw "Timed out waiting to focus tab index $Index."
